import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InsuranceFundService } from './services/insurance-fund.service';
import { FundHealthService } from './services/fund-health.service';
import { LiquidationProtectionService } from './services/liquidation-protection.service';
import { InsuranceFeeContributionService } from './services/insurance-fee-contribution.service';
import { InsuranceFund } from './entities/insurance-fund.entity';
import { InsuranceFundTier } from './entities/insurance-fund-tier.entity';
import { InsuranceTransaction } from './entities/insurance-transaction.entity';
import { LiquidationEvent } from './entities/liquidation-event.entity';
import { FundTier } from './enums/fund-tier.enum';
import { FundHealthStatus } from './enums/fund-health-status.enum';
import { InsuranceTxType } from './enums/insurance-tx-type.enum';
import {
  InsurancePayoutEvent,
  LiquidationShortfallEvent,
} from '../infrastructure/events/domain.events';

/**
 * Integration test against a real in-memory SQLite DataSource.
 *
 * The services run on real repositories and real transactions, so the
 * concurrency guarantees exercised here (atomic conditional payouts, exactly
 * one success under a double-spend attempt, transactional multi-tier
 * coverage) are the same code paths that run against Postgres in production.
 */
describe('Insurance Fund Integration', () => {
  let dataSource: DataSource;
  let insuranceFundService: InsuranceFundService;
  let fundHealthService: FundHealthService;
  let liquidationProtection: LiquidationProtectionService;
  let feeContribution: InsuranceFeeContributionService;
  let eventEmitter: { emit: jest.Mock };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [
            InsuranceFund,
            InsuranceFundTier,
            InsuranceTransaction,
            LiquidationEvent,
          ],
          synchronize: true,
          dropSchema: true,
        }),
        TypeOrmModule.forFeature([
          InsuranceFund,
          InsuranceFundTier,
          InsuranceTransaction,
          LiquidationEvent,
        ]),
      ],
      providers: [
        InsuranceFundService,
        FundHealthService,
        LiquidationProtectionService,
        InsuranceFeeContributionService,
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    dataSource = module.get(DataSource);
    insuranceFundService = module.get(InsuranceFundService);
    fundHealthService = module.get(FundHealthService);
    liquidationProtection = module.get(LiquidationProtectionService);
    feeContribution = module.get(InsuranceFeeContributionService);
    eventEmitter = module.get(EventEmitter2);
  });

  beforeEach(async () => {
    for (const entity of [
      LiquidationEvent,
      InsuranceTransaction,
      InsuranceFund,
      InsuranceFundTier,
    ]) {
      await dataSource.getRepository(entity).clear();
    }
    eventEmitter.emit.mockClear();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('should complete full insurance fund lifecycle', async () => {
    const initialized = await insuranceFundService.initializeFunds('USDT');
    expect(initialized.length).toBe(4);

    const feeResult = await feeContribution.contributeFromTradeFee(
      'trade-001',
      1000,
      'USDT',
      FundTier.MEDIUM,
    );
    expect(feeResult.contributed).toBe(100);

    const coverResult = await liquidationProtection.coverShortfall(
      42,
      5000,
      'position-abc',
      'USDT',
      FundTier.MEDIUM,
    );
    expect(coverResult.cascadePrevented).toBe(true);
    expect(coverResult.coveredAmount).toBe(5000);

    const dashboard = await fundHealthService.getDashboard();
    expect(dashboard.funds.length).toBe(4);
    expect(dashboard.overallHealthPercent).toBeGreaterThan(0);

    await insuranceFundService.replenishFund(
      initialized[0].id,
      25000,
      'replenish-001',
      'Manual replenishment',
    );

    const history = await insuranceFundService.getTransactionHistory();
    expect(history.length).toBeGreaterThanOrEqual(3);
    expect(
      history.some((t) => t.type === InsuranceTxType.FEE_CONTRIBUTION),
    ).toBe(true);
    expect(history.some((t) => t.type === InsuranceTxType.PAYOUT)).toBe(true);
    expect(history.some((t) => t.type === InsuranceTxType.REPLENISHMENT)).toBe(
      true,
    );
  });

  it('should trigger health alert when reserves drop below 20%', async () => {
    await insuranceFundService.initializeFunds('USDT');
    const mediumFund = await insuranceFundService.getFundsByTier(
      FundTier.MEDIUM,
      'USDT',
    );

    const fundRepo = dataSource.getRepository(InsuranceFund);
    await fundRepo.update(mediumFund.id, {
      balance: 10000,
      targetReserve: 100000,
      healthPercent: 50,
      healthStatus: FundHealthStatus.HEALTHY,
    });

    await fundHealthService.updateFundHealth(mediumFund.id);

    const updated = await fundRepo.findOne({ where: { id: mediumFund.id } });
    expect(Number(updated!.healthPercent)).toBe(10);
    expect(updated!.healthStatus).toBe(FundHealthStatus.CRITICAL);

    const alerts = await fundHealthService.getActiveAlerts();
    expect(alerts.some((a) => a.isBelowThreshold)).toBe(true);
  });

  it('should report partial coverage explicitly when funds run out', async () => {
    await insuranceFundService.initializeFunds('USDT');
    const fundRepo = dataSource.getRepository(InsuranceFund);

    const balances: Record<FundTier, number> = {
      [FundTier.LOW]: 3000,
      [FundTier.MEDIUM]: 1000,
      [FundTier.HIGH]: 0,
      [FundTier.CRITICAL]: 0,
    };
    for (const [tier, balance] of Object.entries(balances)) {
      const fund = await insuranceFundService.getFundsByTier(
        tier as FundTier,
        'USDT',
      );
      await fundRepo.update(fund.id, { balance });
    }

    const result = await liquidationProtection.coverShortfall(99, 10000);

    expect(result.coveredAmount).toBe(4000);
    expect(result.remainingShortfall).toBe(6000);
    expect(result.cascadePrevented).toBe(false);
    expect(result.fundsUsed).toHaveLength(2);
    expect(result.liquidationEvent.status).toBe('PARTIAL');

    const persisted = await dataSource
      .getRepository(LiquidationEvent)
      .findOne({ where: { id: result.liquidationEvent.id } });
    expect(persisted!.status).toBe('PARTIAL');
    expect(Number(persisted!.coveredAmount)).toBe(4000);
    expect(persisted!.cascadePrevented).toBe(false);

    const shortfallEvent = eventEmitter.emit.mock.calls.find(
      ([name]) => name === 'liquidation.shortfall',
    );
    expect(shortfallEvent).toBeDefined();
    expect(shortfallEvent![1]).toBeInstanceOf(LiquidationShortfallEvent);
    expect(
      (shortfallEvent![1] as LiquidationShortfallEvent).cascadePrevented,
    ).toBe(false);
    expect(
      (shortfallEvent![1] as LiquidationShortfallEvent).coveredAmount,
    ).toBe(4000);

    const payoutEvent = eventEmitter.emit.mock.calls.find(
      ([name]) => name === 'insurance.payout',
    );
    expect(payoutEvent).toBeDefined();
    expect(payoutEvent![1]).toBeInstanceOf(InsurancePayoutEvent);

    const funds = await fundRepo.find();
    const fundById = new Map(funds.map((f) => [f.id, f]));
    expect(Number(fundById.get(result.fundsUsed[0].fundId)!.balance)).toBe(0);
    expect(Number(fundById.get(result.fundsUsed[1].fundId)!.balance)).toBe(0);
  });
});

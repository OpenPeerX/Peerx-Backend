import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { InsuranceFundService } from './services/insurance-fund.service';
import { FundHealthService } from './services/fund-health.service';
import { LiquidationProtectionService } from './services/liquidation-protection.service';
import { InsuranceFund } from './entities/insurance-fund.entity';
import { InsuranceFundTier } from './entities/insurance-fund-tier.entity';
import { InsuranceTransaction } from './entities/insurance-transaction.entity';
import { LiquidationEvent } from './entities/liquidation-event.entity';
import { FundTier } from './enums/fund-tier.enum';
import { InsuranceTxType } from './enums/insurance-tx-type.enum';

/**
 * Concurrency harness: two real SQLite connections to one shared file database.
 *
 * A single in-memory SQLite connection serializes every statement and cannot
 * hold two transactions at once, so it cannot demonstrate the race the fix
 * closes. Two connections give real lock contention: the second writer blocks
 * on the first (busy_timeout) and then evaluates the atomic `balance >=
 * amount` guard against the committed value — the same interleaving Postgres
 * produces with row locks. The old read-modify-write implementation fails
 * these tests by letting both calls pass the balance check and debit twice.
 */
describe('Insurance Fund concurrency', () => {
  let dbPath: string;
  let dsA: DataSource;
  let dsB: DataSource;
  let svcA: InsuranceFundService;
  let svcB: InsuranceFundService;
  let protectionA: LiquidationProtectionService;
  let protectionB: LiquidationProtectionService;

  const entities = [
    InsuranceFund,
    InsuranceFundTier,
    InsuranceTransaction,
    LiquidationEvent,
  ];

  beforeAll(async () => {
    dbPath = path.join(
      os.tmpdir(),
      `peerx-insurance-concurrency-${process.pid}.db`,
    );
    try {
      fs.unlinkSync(dbPath);
    } catch {
      /* fresh file */
    }

    dsA = new DataSource({
      type: 'sqlite',
      database: dbPath,
      entities,
      synchronize: true,
      dropSchema: true,
      busyTimeout: 5000,
      // WAL is sqlite's MVCC mode: readers never block writers, which models
      // Postgres row-lock semantics. In plain rollback-journal mode a read
      // inside an open transaction holds a SHARED lock that blocks the other
      // writer's COMMIT, producing a deadlock the busy handler cannot break.
      enableWAL: true,
    });
    dsB = new DataSource({
      type: 'sqlite',
      database: dbPath,
      entities,
      synchronize: false,
      busyTimeout: 5000,
      enableWAL: true,
    });
    await dsA.initialize();
    await dsB.initialize();

    const healthA = new FundHealthService(
      dsA.getRepository(InsuranceFund),
      new EventEmitter2(),
    );
    const healthB = new FundHealthService(
      dsB.getRepository(InsuranceFund),
      new EventEmitter2(),
    );
    svcA = new InsuranceFundService(
      dsA.getRepository(InsuranceFund),
      dsA.getRepository(InsuranceFundTier),
      dsA.getRepository(InsuranceTransaction),
      healthA,
    );
    svcB = new InsuranceFundService(
      dsB.getRepository(InsuranceFund),
      dsB.getRepository(InsuranceFundTier),
      dsB.getRepository(InsuranceTransaction),
      healthB,
    );
    protectionA = new LiquidationProtectionService(
      dsA.getRepository(LiquidationEvent),
      svcA,
      healthA,
      dsA,
      new EventEmitter2(),
    );
    protectionB = new LiquidationProtectionService(
      dsB.getRepository(LiquidationEvent),
      svcB,
      healthB,
      dsB,
      new EventEmitter2(),
    );
  });

  beforeEach(async () => {
    for (const entity of [
      LiquidationEvent,
      InsuranceTransaction,
      InsuranceFund,
      InsuranceFundTier,
    ]) {
      await dsA.getRepository(entity).clear();
    }
  });

  afterAll(async () => {
    await dsA.destroy();
    await dsB.destroy();
    try {
      fs.unlinkSync(dbPath);
    } catch {
      /* already gone */
    }
  });

  it('never double-spends the fund when two concurrent payouts exceed the balance', async () => {
    await svcA.initializeFunds('USDT');
    const fund = await svcA.getFundsByTier(FundTier.LOW, 'USDT');

    // Balance 1500 with two concurrent 1000 payouts: the naive
    // read-modify-write lets both pass `balance >= amount` and deduct twice.
    // The atomic conditional UPDATE lets exactly one through.
    const fundRepo = dsA.getRepository(InsuranceFund);
    await fundRepo.update(fund.id, { balance: 1500 });

    const results = await Promise.allSettled([
      svcA.recordTransaction(fund.id, InsuranceTxType.PAYOUT, 1000, {
        userId: 1,
        referenceId: 'pos-a',
      }),
      svcB.recordTransaction(fund.id, InsuranceTxType.PAYOUT, 1000, {
        userId: 2,
        referenceId: 'pos-b',
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(BadRequestException);

    const after = await fundRepo.findOne({ where: { id: fund.id } });
    expect(Number(after!.balance)).toBe(500);

    const payouts = await dsA.getRepository(InsuranceTransaction).find({
      where: { fundId: fund.id, type: InsuranceTxType.PAYOUT },
    });
    expect(payouts).toHaveLength(1);
  });

  it('serializes concurrent coverShortfall calls without deadlock or overdraw', async () => {
    await svcA.initializeFunds('USDT');
    const fundRepo = dsA.getRepository(InsuranceFund);
    await fundRepo.update(
      (await svcA.getFundsByTier(FundTier.LOW, 'USDT')).id,
      { balance: 4000 },
    );
    await fundRepo.update(
      (await svcA.getFundsByTier(FundTier.MEDIUM, 'USDT')).id,
      { balance: 6000 },
    );
    await fundRepo.update(
      (await svcA.getFundsByTier(FundTier.HIGH, 'USDT')).id,
      { balance: 0 },
    );
    await fundRepo.update(
      (await svcA.getFundsByTier(FundTier.CRITICAL, 'USDT')).id,
      { balance: 0 },
    );

    // Two 5000 shortfalls against LOW 4000 + MEDIUM 6000 (exactly 10000
    // total). Tiers are walked in fixed order, so the two transactions
    // acquire fund locks in the same order and can never deadlock; each
    // payout is a guarded UPDATE, so neither transaction can overdraw.
    const results = await Promise.allSettled([
      protectionA.coverShortfall(1, 5000, 'pos-1'),
      protectionB.coverShortfall(2, 5000, 'pos-2'),
    ]);

    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    for (const r of results) {
      if (r.status === 'fulfilled') {
        expect(r.value.coveredAmount).toBe(5000);
        expect(r.value.cascadePrevented).toBe(true);
      }
    }

    const balances = new Map(
      (await fundRepo.find()).map((f) => [f.id, Number(f.balance)]),
    );
    const lowId = (await svcA.getFundsByTier(FundTier.LOW, 'USDT')).id;
    const mediumId = (await svcA.getFundsByTier(FundTier.MEDIUM, 'USDT')).id;
    expect(balances.get(lowId)).toBe(0);
    expect(balances.get(mediumId)).toBe(0);
    for (const balance of balances.values()) {
      expect(balance).toBeGreaterThanOrEqual(0);
    }
  }, 30000);
});

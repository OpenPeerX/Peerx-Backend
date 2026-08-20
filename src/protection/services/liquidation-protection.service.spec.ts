import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LiquidationProtectionService } from './liquidation-protection.service';
import { InsuranceFundService } from './insurance-fund.service';
import { FundHealthService } from './fund-health.service';
import { LiquidationEvent } from '../entities/liquidation-event.entity';
import { FundTier } from '../enums/fund-tier.enum';
import { InsuranceTxType } from '../enums/insurance-tx-type.enum';

describe('LiquidationProtectionService', () => {
  let service: LiquidationProtectionService;
  let insuranceFundService: {
    getFundsByTier: jest.Mock;
    recordTransaction: jest.Mock;
    getFund: jest.Mock;
  };
  let fundHealthService: { updateFundHealth: jest.Mock };
  let liquidationRepo: { create: jest.Mock; save: jest.Mock };
  let eventEmitter: { emit: jest.Mock };

  beforeEach(async () => {
    insuranceFundService = {
      getFundsByTier: jest.fn(),
      recordTransaction: jest.fn(),
      getFund: jest.fn(),
    };
    fundHealthService = { updateFundHealth: jest.fn().mockResolvedValue({}) };
    liquidationRepo = {
      create: jest.fn((d: Partial<LiquidationEvent>) => d),
      save: jest.fn((d: LiquidationEvent) => ({ ...d, id: 'liq-1' })),
    };
    eventEmitter = { emit: jest.fn() };

    // The real service runs the tier walk inside `dataSource.transaction`;
    // the transactional manager persists the liquidation event through the
    // same mocked repository.
    const managerMock = {
      create: jest.fn((_entity: unknown, data: Partial<LiquidationEvent>) =>
        liquidationRepo.create(data),
      ),
      save: jest.fn((_entity: unknown, data: LiquidationEvent) =>
        liquidationRepo.save(data),
      ),
      getRepository: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiquidationProtectionService,
        { provide: InsuranceFundService, useValue: insuranceFundService },
        { provide: FundHealthService, useValue: fundHealthService },
        {
          provide: getRepositoryToken(LiquidationEvent),
          useValue: liquidationRepo,
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(
              (cb: (manager: typeof managerMock) => unknown) => cb(managerMock),
            ),
          },
        },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get(LiquidationProtectionService);
  });

  it('should cover full shortfall from insurance fund', async () => {
    insuranceFundService.getFundsByTier.mockResolvedValue({
      id: 1,
      balance: 100000,
      tier: { tier: FundTier.LOW },
    });
    insuranceFundService.recordTransaction.mockResolvedValue({
      fund: { id: 1, balance: 90000 },
      transaction: { id: 'tx-1' },
    });

    const result = await service.coverShortfall(1, 10000, 'pos-1');

    expect(result.coveredAmount).toBe(10000);
    expect(result.remainingShortfall).toBe(0);
    expect(result.cascadePrevented).toBe(true);
    expect(insuranceFundService.recordTransaction).toHaveBeenCalledWith(
      1,
      InsuranceTxType.PAYOUT,
      10000,
      expect.objectContaining({ userId: 1, referenceId: 'pos-1' }),
      expect.anything(),
    );
    expect(fundHealthService.updateFundHealth).toHaveBeenCalledWith(1);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'liquidation.shortfall',
      expect.any(Object),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'insurance.payout',
      expect.any(Object),
    );
  });

  it('should partially cover when fund balance is insufficient', async () => {
    insuranceFundService.getFundsByTier
      .mockResolvedValueOnce({
        id: 1,
        balance: 3000,
        tier: { tier: FundTier.LOW },
      })
      .mockResolvedValueOnce({
        id: 2,
        balance: 0,
        tier: { tier: FundTier.MEDIUM },
      })
      .mockRejectedValue(new NotFoundException('Fund tier HIGH not found'));

    insuranceFundService.recordTransaction.mockResolvedValue({
      fund: { id: 1, balance: 0 },
      transaction: { id: 'tx-1' },
    });

    const result = await service.coverShortfall(2, 10000);

    expect(result.coveredAmount).toBe(3000);
    expect(result.remainingShortfall).toBe(7000);
    expect(result.cascadePrevented).toBe(false);
    expect(liquidationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'PARTIAL',
        cascadePrevented: false,
        coveredAmount: 3000,
        fundId: 1,
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'liquidation.shortfall',
      expect.any(Object),
    );
  });
});

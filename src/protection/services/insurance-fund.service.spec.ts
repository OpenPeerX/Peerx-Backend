import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { InsuranceFundService } from './insurance-fund.service';
import { FundHealthService } from './fund-health.service';
import { InsuranceFund } from '../entities/insurance-fund.entity';
import { InsuranceFundTier } from '../entities/insurance-fund-tier.entity';
import { InsuranceTransaction } from '../entities/insurance-transaction.entity';
import { FundTier } from '../enums/fund-tier.enum';
import { InsuranceTxType } from '../enums/insurance-tx-type.enum';

describe('InsuranceFundService', () => {
  let service: InsuranceFundService;
  let fundRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  let txRepo: { create: jest.Mock; save: jest.Mock };
  let fundHealthService: { updateFundHealth: jest.Mock };

  /** Mock for the atomic UPDATE query-builder chain. */
  const makeUpdateQb = (affected = 1) => ({
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected }),
  });

  beforeEach(async () => {
    fundHealthService = { updateFundHealth: jest.fn().mockResolvedValue({}) };

    fundRepo = {
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => ({ ...data, id: data.id ?? 1 })),
      createQueryBuilder: jest.fn(() => makeUpdateQb()),
      manager: { transaction: jest.fn() },
    };
    const tierRepo = {
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => ({ ...data, id: data.id ?? 1 })),
    };
    txRepo = {
      create: jest.fn((data) => data),
      save: jest.fn((data) => ({ ...data, id: `tx-${data.fundId}` })),
    };

    // recordTransaction without a manager runs inside a self-managed
    // transaction; the transactional manager delegates back to the same mocks.
    const managerMock = {
      getRepository: jest.fn((entity: unknown): unknown => {
        if (entity === InsuranceFund) return fundRepo;
        if (entity === InsuranceTransaction) return txRepo;
        return tierRepo;
      }),
    };
    fundRepo.manager.transaction.mockImplementation(
      (cb: (manager: typeof managerMock) => unknown) => cb(managerMock),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InsuranceFundService,
        {
          provide: FundHealthService,
          useValue: fundHealthService,
        },
        { provide: getRepositoryToken(InsuranceFund), useValue: fundRepo },
        {
          provide: getRepositoryToken(InsuranceFundTier),
          useValue: tierRepo,
        },
        {
          provide: getRepositoryToken(InsuranceTransaction),
          useValue: txRepo,
        },
      ],
    }).compile();

    service = module.get(InsuranceFundService);
  });

  describe('recordTransaction', () => {
    it('should credit fund on fee contribution', async () => {
      fundRepo.findOne.mockResolvedValue({
        id: 1,
        balance: 50100,
        tier: { tier: FundTier.MEDIUM },
      });

      const result = await service.recordTransaction(
        1,
        InsuranceTxType.FEE_CONTRIBUTION,
        100,
        { referenceId: 'trade-1' },
      );

      expect(fundRepo.createQueryBuilder).toHaveBeenCalled();
      expect(result.fund.balance).toBe(50100);
      expect(result.transaction.type).toBe(InsuranceTxType.FEE_CONTRIBUTION);
      expect(result.transaction.balanceBefore).toBe(50000);
      expect(result.transaction.balanceAfter).toBe(50100);
      expect(fundHealthService.updateFundHealth).toHaveBeenCalledWith(1);
    });

    it('should debit fund on payout', async () => {
      fundRepo.findOne.mockResolvedValue({
        id: 1,
        balance: 45000,
        tier: { tier: FundTier.MEDIUM },
      });

      const result = await service.recordTransaction(
        1,
        InsuranceTxType.PAYOUT,
        5000,
        { userId: 42 },
      );

      expect(result.fund.balance).toBe(45000);
      expect(result.transaction.balanceBefore).toBe(50000);
      expect(result.transaction.balanceAfter).toBe(45000);
    });

    it('should reject a payout when the atomic debit is not applied', async () => {
      // The guarded UPDATE affects 0 rows: the balance is insufficient
      // (either from the start or a concurrent payout drained it first).
      fundRepo.createQueryBuilder.mockReturnValue(makeUpdateQb(0));

      await expect(
        service.recordTransaction(1, InsuranceTxType.PAYOUT, 5000, {
          userId: 42,
        }),
      ).rejects.toThrow(
        new BadRequestException('Insufficient fund balance for payout'),
      );

      expect(fundRepo.findOne).not.toHaveBeenCalled();
      expect(fundHealthService.updateFundHealth).not.toHaveBeenCalled();
    });
  });

  describe('contributeFromFees', () => {
    it('should record fee contribution with trade reference', async () => {
      fundRepo.findOne.mockResolvedValue({
        id: 1,
        balance: 10050,
        tier: { tier: FundTier.MEDIUM },
      });

      const result = await service.contributeFromFees(1, 50, 'trade-abc');

      expect(result.transaction.referenceId).toBe('trade-abc');
      expect(result.transaction.type).toBe(InsuranceTxType.FEE_CONTRIBUTION);
      expect(result.transaction.balanceBefore).toBe(10000);
      expect(result.transaction.balanceAfter).toBe(10050);
    });
  });
});

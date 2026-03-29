import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InsuranceClaimService } from '../services/insurance-claim.service';
import { InsuranceClaim, ClaimStatus, ClaimReason } from '../entities/insurance-claim.entity';
import { InsuranceFund, FundStatus } from '../entities/insurance-fund.entity';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';

describe('InsuranceClaimService', () => {
  let service: InsuranceClaimService;
  let claimRepository: Repository<InsuranceClaim>;
  let fundRepository: Repository<InsuranceFund>;

  const mockFund: InsuranceFund = {
    id: 1,
    fundType: 'PRIMARY',
    status: FundStatus.ACTIVE,
    balance: 1000,
    minimumBalance: 100,
    targetBalance: 1000,
    coverageRatio: 75,
    contributionRate: 0.001,
    totalContributions: 1000,
    totalPayouts: 0,
    liquidationsCovered: 0,
    claimCount: 0,
    autoRefillEnabled: false,
    lastAutoRefillAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  const mockClaim: InsuranceClaim = {
    id: 1,
    fund: mockFund,
    claimantUserId: 1,
    originalLoss: 1000,
    claimReason: ClaimReason.LIQUIDATION_LOSS,
    description: 'Test claim',
    coverageAmount: 750,
    uncoveredLoss: 250,
    coveragePercentage: 75,
    status: ClaimStatus.PENDING,
    submittedAt: new Date(),
    approverUserId: null,
    approvalNotes: null,
    approvedAt: null,
    paidAmount: 0,
    paidAt: null,
    rejectionReason: null,
    linkedLiquidationId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InsuranceClaimService,
        {
          provide: getRepositoryToken(InsuranceClaim),
          useValue: {
            create: jest.fn().mockReturnValue(mockClaim),
            save: jest.fn().mockResolvedValue(mockClaim),
            findOne: jest.fn().mockResolvedValue(mockClaim),
            find: jest.fn().mockResolvedValue([mockClaim]),
            count: jest.fn().mockResolvedValue(1),
            createQueryBuilder: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue([mockClaim]),
              getRawOne: jest.fn().mockResolvedValue({ total: 750 }),
              limit: jest.fn().mockReturnThis(),
              offset: jest.fn().mockReturnThis(),
            }),
          },
        },
        {
          provide: getRepositoryToken(InsuranceFund),
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockFund),
            save: jest.fn().mockResolvedValue(mockFund),
          },
        },
      ],
    }).compile();

    service = module.get<InsuranceClaimService>(InsuranceClaimService);
    claimRepository = module.get<Repository<InsuranceClaim>>(
      getRepositoryToken(InsuranceClaim),
    );
    fundRepository = module.get<Repository<InsuranceFund>>(
      getRepositoryToken(InsuranceFund),
    );
  });

  describe('submitClaim', () => {
    it('should submit a new claim', async () => {
      const createDto = {
        fundId: 1,
        claimantUserId: 1,
        originalLoss: 1000,
        claimReason: ClaimReason.LIQUIDATION_LOSS,
        description: 'Test claim',
      };

      const result = await service.submitClaim(1, createDto as any);

      expect(result).toBeDefined();
      expect(claimRepository.create).toHaveBeenCalled();
      expect(claimRepository.save).toHaveBeenCalled();
    });

    it('should throw error for negative loss', async () => {
      const createDto = {
        fundId: 1,
        claimantUserId: 1,
        originalLoss: -100,
        claimReason: ClaimReason.LIQUIDATION_LOSS,
        description: 'Invalid claim',
      };

      await expect(service.submitClaim(1, createDto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error if fund not found', async () => {
      jest.spyOn(fundRepository, 'findOne').mockResolvedValueOnce(null);

      const createDto = {
        fundId: 1,
        claimantUserId: 1,
        originalLoss: 1000,
        claimReason: ClaimReason.LIQUIDATION_LOSS,
        description: 'Test claim',
      };

      await expect(service.submitClaim(1, createDto as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('approveClaim', () => {
    it('should approve a pending claim', async () => {
      jest.spyOn(claimRepository, 'findOne').mockResolvedValueOnce({
        ...mockClaim,
        status: ClaimStatus.PENDING,
      });

      const result = await service.approveClaim(1, 2, 'Looks good');

      expect(result.status).toEqual(ClaimStatus.APPROVED);
      expect(result.approverUserId).toEqual(2);
      expect(claimRepository.save).toHaveBeenCalled();
    });

    it('should throw error if claim already processed', async () => {
      jest.spyOn(claimRepository, 'findOne').mockResolvedValueOnce({
        ...mockClaim,
        status: ClaimStatus.PAID,
      });

      await expect(service.approveClaim(1, 2)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('payoutClaim', () => {
    it('should payout an approved claim', async () => {
      jest.spyOn(claimRepository, 'findOne').mockResolvedValueOnce({
        ...mockClaim,
        status: ClaimStatus.APPROVED,
        fund: mockFund,
      });

      const result = await service.payoutClaim(1, 1);

      expect(result.status).toEqual(ClaimStatus.PAID);
      expect(result.paidAmount).toEqual(mockClaim.coverageAmount);
      expect(claimRepository.save).toHaveBeenCalled();
    });

    it('should throw error if claim not approved', async () => {
      jest.spyOn(claimRepository, 'findOne').mockResolvedValueOnce(mockClaim);

      await expect(service.payoutClaim(1, 1)).rejects.toThrow(ConflictException);
    });
  });

  describe('rejectClaim', () => {
    it('should reject a pending claim', async () => {
      jest.spyOn(claimRepository, 'findOne').mockResolvedValueOnce(mockClaim);

      const result = await service.rejectClaim(1, 2, 'Insufficient evidence');

      expect(result.status).toEqual(ClaimStatus.REJECTED);
      expect(result.rejectionReason).toEqual('Insufficient evidence');
      expect(claimRepository.save).toHaveBeenCalled();
    });

    it('should throw error if claim already paid', async () => {
      jest.spyOn(claimRepository, 'findOne').mockResolvedValueOnce({
        ...mockClaim,
        status: ClaimStatus.PAID,
      });

      await expect(service.rejectClaim(1, 2, 'Too late')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('getClaimStats', () => {
    it('should return claim statistics', async () => {
      jest
        .spyOn(claimRepository, 'find')
        .mockResolvedValueOnce([
          mockClaim,
          { ...mockClaim, status: ClaimStatus.APPROVED },
        ]);

      const stats = await service.getClaimStats(1);

      expect(stats.totalClaims).toBe(2);
      expect(stats.pendingCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculatePendingClaimsValue', () => {
    it('should calculate total pending claims value', async () => {
      const result = await service.calculatePendingClaimsValue(1);

      expect(result).toEqual(750);
    });
  });

  describe('getTotalUncoveredLosses', () => {
    it('should calculate total uncovered losses', async () => {
      const result = await service.getTotalUncoveredLosses(1);

      expect(result).toBeDefined();
    });
  });
});

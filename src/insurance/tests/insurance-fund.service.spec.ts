import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InsuranceFundService } from '../services/insurance-fund.service';
import { InsuranceFund, FundStatus, FundType } from '../entities/insurance-fund.entity';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';

describe('InsuranceFundService', () => {
  let service: InsuranceFundService;
  let fundRepository: Repository<InsuranceFund>;

  const mockFund: InsuranceFund = {
    id: 1,
    fundType: FundType.PRIMARY,
    status: FundStatus.ACTIVE,
    balance: 1000,
    totalContributions: 1000,
    totalPayouts: 0,
    minimumBalance: 100,
    targetBalance: 1000,
    coverageRatio: 75,
    contributionRate: 0.001,
    autoRefillEnabled: false,
    lastAutoRefillAt: null,
    liquidationsCovered: 0,
    claimCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InsuranceFundService,
        {
          provide: getRepositoryToken(InsuranceFund),
          useValue: {
            create: jest.fn().mockReturnValue(mockFund),
            save: jest.fn().mockResolvedValue(mockFund),
            findOne: jest.fn().mockResolvedValue(mockFund),
            find: jest.fn().mockResolvedValue([mockFund]),
          },
        },
      ],
    }).compile();

    service = module.get<InsuranceFundService>(InsuranceFundService);
    fundRepository = module.get<Repository<InsuranceFund>>(
      getRepositoryToken(InsuranceFund),
    );
  });

  describe('createFund', () => {
    it('should create a new fund', async () => {
      const createDto = {
        fundType: FundType.PRIMARY,
        minimumBalance: 100,
        targetBalance: 1000,
        coverageRatio: 75,
        contributionRate: 0.001,
      };

      const result = await service.createFund(createDto as any);

      expect(result).toEqual(mockFund);
      expect(fundRepository.create).toHaveBeenCalled();
      expect(fundRepository.save).toHaveBeenCalled();
    });

    it('should throw error if primary fund already exists', async () => {
      jest
        .spyOn(fundRepository, 'findOne')
        .mockResolvedValueOnce(mockFund);

      const createDto = {
        fundType: FundType.PRIMARY,
        minimumBalance: 100,
        targetBalance: 1000,
      };

      await expect(service.createFund(createDto as any)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('getFundById', () => {
    it('should return fund by id', async () => {
      const result = await service.getFundById(1);
      expect(result).toEqual(mockFund);
    });

    it('should throw NotFoundException if fund not found', async () => {
      jest.spyOn(fundRepository, 'findOne').mockResolvedValueOnce(null);

      await expect(service.getFundById(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('depositToFund', () => {
    it('should deposit to fund', async () => {
      jest.spyOn(fundRepository, 'findOne').mockResolvedValueOnce(mockFund);

      const result = await service.depositToFund(1, 100);

      expect(result.balance).toEqual(mockFund.balance + 100);
      expect(fundRepository.save).toHaveBeenCalled();
    });

    it('should throw error for negative deposit', async () => {
      await expect(service.depositToFund(1, -100)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('withdrawFromFund', () => {
    it('should withdraw from fund', async () => {
      jest.spyOn(fundRepository, 'findOne').mockResolvedValueOnce(mockFund);

      const result = await service.withdrawFromFund(1, 100);

      expect(result.balance).toEqual(mockFund.balance - 100);
      expect(fundRepository.save).toHaveBeenCalled();
    });

    it('should throw error for insufficient balance', async () => {
      jest
        .spyOn(fundRepository, 'findOne')
        .mockResolvedValueOnce({ ...mockFund, balance: 50 });

      await expect(service.withdrawFromFund(1, 100)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('isLowBalance', () => {
    it('should return true if balance is low', () => {
      const fund = { ...mockFund, balance: 50 };
      expect(service.isLowBalance(fund)).toBe(true);
    });

    it('should return false if balance is adequate', () => {
      expect(service.isLowBalance(mockFund)).toBe(false);
    });
  });

  describe('getMaxCoverage', () => {
    it('should calculate max coverage based on coverage ratio', () => {
      const coverage = service.getMaxCoverage(mockFund, 1000);
      // 1000 * 75% = 750, but limited by balance (1000)
      expect(coverage).toEqual(750);
    });

    it('should limit coverage by fund balance', () => {
      const fund = { ...mockFund, balance: 500 };
      const coverage = service.getMaxCoverage(fund, 1000);
      expect(coverage).toEqual(500);
    });
  });

  describe('getFundingLevel', () => {
    it('should calculate funding level as percentage', () => {
      const level = service.getFundingLevel(mockFund);
      expect(level).toEqual(100); // 1000 / 1000 * 100
    });

    it('should return 50% if balance is half target', () => {
      const fund = { ...mockFund, balance: 500 };
      const level = service.getFundingLevel(fund);
      expect(level).toEqual(50);
    });
  });

  describe('pauseFund', () => {
    it('should pause fund', async () => {
      jest.spyOn(fundRepository, 'findOne').mockResolvedValueOnce(mockFund);

      const result = await service.pauseFund(1);

      expect(result.status).toEqual(FundStatus.PAUSED);
      expect(fundRepository.save).toHaveBeenCalled();
    });
  });

  describe('getStatistics', () => {
    it('should return fund statistics', async () => {
      jest
        .spyOn(fundRepository, 'find')
        .mockResolvedValueOnce([mockFund, mockFund]);

      const stats = await service.getStatistics();

      expect(stats.totalFunds).toEqual(2);
      expect(stats.totalBalance).toBeGreaterThan(0);
    });
  });
});

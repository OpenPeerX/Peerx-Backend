import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PortfolioAnalyticsService } from './portfolio-analytics.service';
import { PortfolioSnapshot } from '../entities/portfolio-snapshot.entity';
import { PerformanceHistory } from '../entities/performance-history.entity';
import { Benchmark } from '../entities/benchmark.entity';
import { Portfolio } from '../../portfolio/entities/portfolio.entity';
import { MarketData } from '../../trading/entities/market-data.entity';

describe('PortfolioAnalyticsService', () => {
  let service: PortfolioAnalyticsService;
  let snapshotRepository: jest.Mocked<Repository<PortfolioSnapshot>>;
  let portfolioRepository: jest.Mocked<Repository<Portfolio>>;
  let marketDataRepository: jest.Mocked<Repository<MarketData>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfolioAnalyticsService,
        {
          provide: getRepositoryToken(PortfolioSnapshot),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PerformanceHistory),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Benchmark),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Portfolio),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(MarketData),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PortfolioAnalyticsService>(PortfolioAnalyticsService);
    snapshotRepository = module.get(getRepositoryToken(PortfolioSnapshot));
    portfolioRepository = module.get(getRepositoryToken(Portfolio));
    marketDataRepository = module.get(getRepositoryToken(MarketData));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculatePortfolioValue', () => {
    it('should calculate total portfolio value correctly', async () => {
      const userId = 1;
      const portfolios = [
        { userId, asset: 'BTC', balance: '1.0' },
        { userId, asset: 'ETH', balance: '10.0' },
      ];

      portfolioRepository.find.mockResolvedValue(portfolios as any);
      marketDataRepository.findOne
        .mockResolvedValueOnce({ currentPrice: 50000 } as any)
        .mockResolvedValueOnce({ currentPrice: 3000 } as any);

      const result = await service.calculatePortfolioValue(userId);

      expect(result.userId).toBe(userId);
      expect(result.totalValue).toBe(80000);
      expect(result.assetValues['BTC']).toBe(50000);
      expect(result.assetValues['ETH']).toBe(30000);
    });

    it('should handle empty portfolio', async () => {
      portfolioRepository.find.mockResolvedValue([]);

      const result = await service.calculatePortfolioValue(1);

      expect(result.totalValue).toBe(0);
      expect(Object.keys(result.assetValues).length).toBe(0);
    });

    it('should calculate asset allocation percentages', async () => {
      const portfolios = [{ userId: 1, asset: 'BTC', balance: '1.0' }];
      portfolioRepository.find.mockResolvedValue(portfolios as any);
      marketDataRepository.findOne.mockResolvedValue({ currentPrice: 50000 } as any);

      const result = await service.calculatePortfolioValue(1);

      expect(result.assetAllocation['BTC']).toBe(100);
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should calculate performance metrics correctly', async () => {
      const userId = 1;
      const snapshots = [
        { totalValue: '10000', timestamp: new Date('2024-01-01') },
        { totalValue: '11000', timestamp: new Date('2024-01-02') },
        { totalValue: '12000', timestamp: new Date('2024-01-03') },
      ];

      snapshotRepository.find.mockResolvedValue(snapshots as any);

      const result = await service.getPerformanceMetrics(userId, '1M');

      expect(result.userId).toBe(userId);
      expect(result.totalReturn).toBe(20);
      expect(result.maxDrawdown).toBe(0);
    });

    it('should return zero metrics when no data available', async () => {
      snapshotRepository.find.mockResolvedValue([]);

      const result = await service.getPerformanceMetrics(1, '1M');

      expect(result.totalReturn).toBe(0);
      expect(result.annualizedReturn).toBe(0);
    });
  });

  describe('createSnapshot', () => {
    it('should create a portfolio snapshot', async () => {
      const userId = 1;
      const mockSnapshot = {
        userId,
        totalValue: 50000,
        assetAllocation: { BTC: 60, ETH: 40 },
        timestamp: new Date(),
      };

      jest.spyOn(service, 'calculatePortfolioValue').mockResolvedValue({
        userId,
        totalValue: 50000,
        assetValues: { BTC: 30000, ETH: 20000 },
        assetAllocation: { BTC: 60, ETH: 40 },
        timestamp: new Date(),
      });

      snapshotRepository.findOne.mockResolvedValue(null);
      snapshotRepository.create.mockReturnValue(mockSnapshot as any);
      snapshotRepository.save.mockResolvedValue(mockSnapshot as any);

      const result = await service.createSnapshot(userId);

      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
      expect(snapshotRepository.create).toHaveBeenCalled();
      expect(snapshotRepository.save).toHaveBeenCalled();
    });
  });

  describe('getAssetAllocation', () => {
    it('should return asset allocation', async () => {
      jest.spyOn(service, 'calculatePortfolioValue').mockResolvedValue({
        userId: 1,
        totalValue: 100000,
        assetValues: { BTC: 60000, ETH: 40000 },
        assetAllocation: { BTC: 60, ETH: 40 },
        timestamp: new Date(),
      });

      const result = await service.getAssetAllocation(1);

      expect(result.userId).toBe(1);
      expect(result.allocation['BTC']).toBe(60);
      expect(result.allocation['ETH']).toBe(40);
    });
  });

  describe('getHistoricalPerformance', () => {
    it('should return historical performance data', async () => {
      const mockData = [
        { userId: 1, period: 'daily', date: new Date(), return: 2.5 },
      ];

      snapshotRepository.find.mockResolvedValue(mockData as any);

      const result = await service.getHistoricalPerformance(1, 'daily');

      expect(result).toBeDefined();
    });
  });

  describe('getSnapshots', () => {
    it('should return portfolio snapshots', async () => {
      const mockSnapshots = [
        { userId: 1, totalValue: 50000, timestamp: new Date() },
      ];

      snapshotRepository.find.mockResolvedValue(mockSnapshots as any);

      const result = await service.getSnapshots(1);

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(1);
    });
  });
});

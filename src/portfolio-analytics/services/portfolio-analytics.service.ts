import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { PortfolioSnapshot } from '../entities/portfolio-snapshot.entity';
import { PerformanceHistory, PerformancePeriod } from '../entities/performance-history.entity';
import { Benchmark } from '../entities/benchmark.entity';
import { Portfolio } from '../../portfolio/entities/portfolio.entity';
import { MarketData } from '../../trading/entities/market-data.entity';

@Injectable()
export class PortfolioAnalyticsService {
  private readonly logger = new Logger(PortfolioAnalyticsService.name);

  constructor(
    @InjectRepository(PortfolioSnapshot)
    private readonly snapshotRepository: Repository<PortfolioSnapshot>,
    @InjectRepository(PerformanceHistory)
    private readonly performanceRepository: Repository<PerformanceHistory>,
    @InjectRepository(Benchmark)
    private readonly benchmarkRepository: Repository<Benchmark>,
    @InjectRepository(Portfolio)
    private readonly portfolioRepository: Repository<Portfolio>,
    @InjectRepository(MarketData)
    private readonly marketDataRepository: Repository<MarketData>,
  ) {}

  async calculatePortfolioValue(userId: number): Promise<any> {
    const portfolios = await this.portfolioRepository.find({ where: { userId } });
    
    let totalValue = 0;
    const assetValues: Record<string, number> = {};
    const assetAllocation: Record<string, number> = {};

    for (const portfolio of portfolios) {
      const marketData = await this.marketDataRepository.findOne({
        where: { asset: portfolio.asset }
      });

      const currentPrice = marketData?.currentPrice || 0;
      const value = Number(portfolio.balance) * currentPrice;
      
      assetValues[portfolio.asset] = value;
      totalValue += value;
    }

    // Calculate allocation percentages
    for (const [asset, value] of Object.entries(assetValues)) {
      assetAllocation[asset] = totalValue > 0 ? (value / totalValue) * 100 : 0;
    }

    return {
      userId,
      totalValue,
      assetValues,
      assetAllocation,
      timestamp: new Date(),
    };
  }

  async getPerformanceMetrics(userId: number, period: '1M' | '3M' | '6M' | '1Y' | 'ALL' = '1M'): Promise<any> {
    const now = new Date();
    const startDate = this.getStartDate(period);

    const snapshots = await this.snapshotRepository.find({
      where: {
        userId,
        timestamp: Between(startDate, now),
      },
      order: { timestamp: 'ASC' },
    });

    if (snapshots.length === 0) {
      return {
        userId,
        totalReturn: 0,
        annualizedReturn: 0,
        volatility: 0,
        maxDrawdown: 0,
        period,
      };
    }

    const firstValue = Number(snapshots[0].totalValue);
    const lastValue = Number(snapshots[snapshots.length - 1].totalValue);
    const totalReturn = ((lastValue - firstValue) / firstValue) * 100;

    // Calculate annualized return
    const daysDiff = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const annualizedReturn = totalReturn * (365 / daysDiff);

    // Calculate volatility
    const returns: number[] = [];
    for (let i = 1; i < snapshots.length; i++) {
      const prevValue = Number(snapshots[i - 1].totalValue);
      const currentValue = Number(snapshots[i].totalValue);
      returns.push((currentValue - prevValue) / prevValue);
    }

    const volatility = this.calculateStandardDeviation(returns) * Math.sqrt(365) * 100;

    // Calculate max drawdown
    let peak = firstValue;
    let maxDrawdown = 0;
    for (const snapshot of snapshots) {
      const value = Number(snapshot.totalValue);
      if (value > peak) {
        peak = value;
      }
      const drawdown = ((peak - value) / peak) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return {
      userId,
      totalReturn,
      annualizedReturn,
      volatility,
      maxDrawdown,
      period,
      startDate,
      endDate: now,
    };
  }

  async getAssetAllocation(userId: number): Promise<any> {
    const portfolioValue = await this.calculatePortfolioValue(userId);
    return {
      userId,
      allocation: portfolioValue.assetAllocation,
      values: portfolioValue.assetValues,
      totalValue: portfolioValue.totalValue,
      timestamp: portfolioValue.timestamp,
    };
  }

  async getHistoricalPerformance(
    userId: number,
    period: PerformancePeriod = PerformancePeriod.DAILY,
    startDate?: Date,
    endDate?: Date,
  ): Promise<PerformanceHistory[]> {
    const now = endDate || new Date();
    const start = startDate || this.getStartDate('1M');

    return this.performanceRepository.find({
      where: {
        userId,
        period,
        date: Between(start, now),
      },
      order: { date: 'ASC' },
    });
  }

  async createSnapshot(userId: number): Promise<PortfolioSnapshot> {
    const portfolioValue = await this.calculatePortfolioValue(userId);

    const previousSnapshot = await this.snapshotRepository.findOne({
      where: { userId },
      order: { timestamp: 'DESC' },
    });

    const snapshot = this.snapshotRepository.create({
      userId,
      totalValue: portfolioValue.totalValue,
      previousValue: previousSnapshot ? Number(previousSnapshot.totalValue) : null,
      profitLoss: previousSnapshot
        ? portfolioValue.totalValue - Number(previousSnapshot.totalValue)
        : null,
      returns: previousSnapshot
        ? ((portfolioValue.totalValue - Number(previousSnapshot.totalValue)) /
            Number(previousSnapshot.totalValue)) *
          100
        : null,
      assetAllocation: portfolioValue.assetAllocation,
      assetValues: portfolioValue.assetValues,
      timestamp: new Date(),
    });

    return this.snapshotRepository.save(snapshot);
  }

  async getSnapshots(
    userId: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<PortfolioSnapshot[]> {
    const now = endDate || new Date();
    const start = startDate || this.getStartDate('1M');

    return this.snapshotRepository.find({
      where: {
        userId,
        timestamp: Between(start, now),
      },
      order: { timestamp: 'DESC' },
    });
  }

  private getStartDate(period: string): Date {
    const now = new Date();
    switch (period) {
      case '1M':
        return new Date(now.setMonth(now.getMonth() - 1));
      case '3M':
        return new Date(now.setMonth(now.getMonth() - 3));
      case '6M':
        return new Date(now.setMonth(now.getMonth() - 6));
      case '1Y':
        return new Date(now.setFullYear(now.getFullYear() - 1));
      default:
        return new Date(now.setFullYear(now.getFullYear() - 5));
    }
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squareDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
  }
}

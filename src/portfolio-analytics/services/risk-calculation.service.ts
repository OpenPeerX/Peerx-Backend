import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { RiskMetrics } from '../entities/risk-metrics.entity';
import { PortfolioSnapshot } from '../entities/portfolio-snapshot.entity';
import { Benchmark } from '../entities/benchmark.entity';

@Injectable()
export class RiskCalculationService {
  private readonly logger = new Logger(RiskCalculationService.name);
  private readonly riskFreeRate = 0.02; // 2% annual risk-free rate

  constructor(
    @InjectRepository(RiskMetrics)
    private readonly riskMetricsRepository: Repository<RiskMetrics>,
    @InjectRepository(PortfolioSnapshot)
    private readonly snapshotRepository: Repository<PortfolioSnapshot>,
    @InjectRepository(Benchmark)
    private readonly benchmarkRepository: Repository<Benchmark>,
  ) {}

  async calculateVaR(userId: number, confidenceLevel: 0.95 | 0.99 = 0.95, period: number = 1): Promise<number> {
    const snapshots = await this.snapshotRepository.find({
      where: { userId },
      order: { timestamp: 'DESC' },
      take: 252, // Last year of trading days
    });

    if (snapshots.length < 30) {
      throw new Error('Insufficient data for VaR calculation');
    }

    // Calculate daily returns
    const returns: number[] = [];
    for (let i = 1; i < snapshots.length; i++) {
      const prevValue = Number(snapshots[i].totalValue);
      const currentValue = Number(snapshots[i - 1].totalValue);
      returns.push((currentValue - prevValue) / prevValue);
    }

    // Sort returns
    returns.sort((a, b) => a - b);

    // Historical VaR
    const index = Math.floor((1 - confidenceLevel) * returns.length);
    const varValue = Math.abs(returns[index]) * Number(snapshots[0].totalValue) * Math.sqrt(period);

    return varValue;
  }

  async calculateSharpeRatio(userId: number, period: '1M' | '3M' | '6M' | '1Y' = '1Y'): Promise<number> {
    const snapshots = await this.getHistoricalSnapshots(userId, period);
    
    if (snapshots.length < 30) {
      return 0;
    }

    const returns = this.calculateReturns(snapshots);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const excessReturn = avgReturn - this.riskFreeRate / 252; // Daily risk-free rate
    
    const volatility = this.calculateStandardDeviation(returns);
    
    if (volatility === 0) return 0;
    
    const sharpeRatio = (excessReturn / volatility) * Math.sqrt(252);
    
    return sharpeRatio;
  }

  async calculateSortinoRatio(userId: number, period: '1M' | '3M' | '6M' | '1Y' = '1Y'): Promise<number> {
    const snapshots = await this.getHistoricalSnapshots(userId, period);
    
    if (snapshots.length < 30) {
      return 0;
    }

    const returns = this.calculateReturns(snapshots);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const excessReturn = avgReturn - this.riskFreeRate / 252;
    
    // Downside deviation (only negative returns)
    const negativeReturns = returns.filter(r => r < 0);
    const downsideDeviation = negativeReturns.length > 0
      ? this.calculateStandardDeviation(negativeReturns)
      : 0;
    
    if (downsideDeviation === 0) return 0;
    
    const sortinoRatio = (excessReturn / downsideDeviation) * Math.sqrt(252);
    
    return sortinoRatio;
  }

  async calculateCalmarRatio(userId: number, period: '1Y' | '2Y' | '3Y' = '1Y'): Promise<number> {
    const snapshots = await this.getHistoricalSnapshots(userId, period);
    
    if (snapshots.length < 30) {
      return 0;
    }

    // Calculate annualized return
    const firstValue = Number(snapshots[snapshots.length - 1].totalValue);
    const lastValue = Number(snapshots[0].totalValue);
    const totalReturn = (lastValue - firstValue) / firstValue;
    
    const years = period === '1Y' ? 1 : period === '2Y' ? 2 : 3;
    const annualizedReturn = Math.pow(1 + totalReturn, 1 / years) - 1;
    
    // Calculate max drawdown
    const maxDrawdown = await this.calculateMaxDrawdown(userId);
    
    if (maxDrawdown === 0) return 0;
    
    const calmarRatio = annualizedReturn / Math.abs(maxDrawdown);
    
    return calmarRatio;
  }

  async calculateMaxDrawdown(userId: number): Promise<number> {
    const snapshots = await this.snapshotRepository.find({
      where: { userId },
      order: { timestamp: 'ASC' },
    });

    if (snapshots.length === 0) return 0;

    let peak = Number(snapshots[0].totalValue);
    let maxDrawdown = 0;

    for (const snapshot of snapshots) {
      const value = Number(snapshot.totalValue);
      if (value > peak) {
        peak = value;
      }
      const drawdown = (peak - value) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown * 100; // Return as percentage
  }

  async calculateVolatility(userId: number, period: '1M' | '3M' | '6M' | '1Y' = '1Y'): Promise<{ daily: number; annualized: number }> {
    const snapshots = await this.getHistoricalSnapshots(userId, period);
    
    if (snapshots.length < 30) {
      return { daily: 0, annualized: 0 };
    }

    const returns = this.calculateReturns(snapshots);
    const dailyVolatility = this.calculateStandardDeviation(returns);
    const annualizedVolatility = dailyVolatility * Math.sqrt(252);
    
    return {
      daily: dailyVolatility * 100,
      annualized: annualizedVolatility * 100,
    };
  }

  async calculateBetaAndAlpha(
    userId: number,
    benchmarkSymbol: string = 'BTC',
    period: '1M' | '3M' | '6M' | '1Y' = '1Y',
  ): Promise<{ beta: number; alpha: number }> {
    const snapshots = await this.getHistoricalSnapshots(userId, period);
    const benchmark = await this.benchmarkRepository.findOne({
      where: { symbol: benchmarkSymbol },
    });

    if (!benchmark || snapshots.length < 30) {
      return { beta: 0, alpha: 0 };
    }

    const portfolioReturns = this.calculateReturns(snapshots);
    // In production, you'd calculate benchmark returns from historical data
    const benchmarkReturns = portfolioReturns.map(r => r * 0.8); // Simplified

    // Calculate beta
    const covariance = this.calculateCovariance(portfolioReturns, benchmarkReturns);
    const benchmarkVariance = this.calculateVariance(benchmarkReturns);
    
    const beta = benchmarkVariance !== 0 ? covariance / benchmarkVariance : 0;
    
    // Calculate alpha
    const avgPortfolioReturn = portfolioReturns.reduce((sum, r) => sum + r, 0) / portfolioReturns.length;
    const avgBenchmarkReturn = benchmarkReturns.reduce((sum, r) => sum + r, 0) / benchmarkReturns.length;
    
    const alpha = avgPortfolioReturn - beta * avgBenchmarkReturn;
    
    return {
      beta: beta * 252, // Annualized
      alpha: alpha * 252, // Annualized
    };
  }

  async saveRiskMetrics(userId: number, metrics: Partial<RiskMetrics>): Promise<RiskMetrics> {
    const riskMetrics = this.riskMetricsRepository.create({
      userId,
      ...metrics,
      calculatedAt: new Date(),
    });

    return this.riskMetricsRepository.save(riskMetrics);
  }

  async getLatestRiskMetrics(userId: number): Promise<RiskMetrics | null> {
    return this.riskMetricsRepository.findOne({
      where: { userId },
      order: { calculatedAt: 'DESC' },
    });
  }

  private async getHistoricalSnapshots(userId: number, period: string): Promise<PortfolioSnapshot[]> {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case '1M':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case '3M':
        startDate = new Date(now.setMonth(now.getMonth() - 3));
        break;
      case '6M':
        startDate = new Date(now.setMonth(now.getMonth() - 6));
        break;
      case '1Y':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      case '2Y':
        startDate = new Date(now.setFullYear(now.getFullYear() - 2));
        break;
      case '3Y':
        startDate = new Date(now.setFullYear(now.getFullYear() - 3));
        break;
      default:
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
    }

    return this.snapshotRepository.find({
      where: {
        userId,
        timestamp: Between(startDate, new Date()),
      },
      order: { timestamp: 'DESC' },
    });
  }

  private calculateReturns(snapshots: PortfolioSnapshot[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < snapshots.length; i++) {
      const prevValue = Number(snapshots[i].totalValue);
      const currentValue = Number(snapshots[i - 1].totalValue);
      returns.push((currentValue - prevValue) / prevValue);
    }
    return returns;
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squareDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
  }

  private calculateCovariance(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;
    const meanX = x.reduce((sum, val) => sum + val, 0) / x.length;
    const meanY = y.reduce((sum, val) => sum + val, 0) / y.length;
    const covariance = x.reduce((sum, _, i) => {
      return sum + (x[i] - meanX) * (y[i] - meanY);
    }, 0) / x.length;
    return covariance;
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squareDiffs = values.map(val => Math.pow(val - mean, 2));
    return squareDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }
}

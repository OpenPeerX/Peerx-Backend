import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { PerformanceHistory, PerformancePeriod } from '../entities/performance-history.entity';
import { PortfolioSnapshot } from '../entities/portfolio-snapshot.entity';
import { RiskMetrics } from '../entities/risk-metrics.entity';
import { DashboardDataDto } from '../dto/report.dto';

@Injectable()
export class ReportingService {
  private readonly logger = new Logger(ReportingService.name);

  constructor(
    @InjectRepository(PerformanceHistory)
    private readonly performanceRepository: Repository<PerformanceHistory>,
    @InjectRepository(PortfolioSnapshot)
    private readonly snapshotRepository: Repository<PortfolioSnapshot>,
    @InjectRepository(RiskMetrics)
    private readonly riskMetricsRepository: Repository<RiskMetrics>,
  ) {}

  async generateDailyReport(userId: number, date: Date = new Date()): Promise<any> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const snapshots = await this.snapshotRepository.find({
      where: {
        userId,
        timestamp: Between(startOfDay, endOfDay),
      },
      order: { timestamp: 'ASC' },
    });

    const riskMetrics = await this.riskMetricsRepository.findOne({
      where: { userId },
      order: { calculatedAt: 'DESC' },
    });

    if (snapshots.length === 0) {
      return {
        userId,
        date,
        message: 'No data available for this date',
      };
    }

    const openingValue = Number(snapshots[0].totalValue);
    const closingValue = Number(snapshots[snapshots.length - 1].totalValue);
    const dailyReturn = ((closingValue - openingValue) / openingValue) * 100;

    return {
      userId,
      date,
      openingValue,
      closingValue,
      dailyReturn,
      highValue: Math.max(...snapshots.map(s => Number(s.totalValue))),
      lowValue: Math.min(...snapshots.map(s => Number(s.totalValue))),
      riskMetrics: riskMetrics
        ? {
            var95: riskMetrics.var95,
            sharpeRatio: riskMetrics.sharpeRatio,
            maxDrawdown: riskMetrics.maxDrawdown,
          }
        : null,
    };
  }

  async generateWeeklyReport(userId: number, weekStartDate: Date = new Date()): Promise<any> {
    const startOfWeek = new Date(weekStartDate);
    const endOfWeek = new Date(weekStartDate);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    const snapshots = await this.snapshotRepository.find({
      where: {
        userId,
        timestamp: Between(startOfWeek, endOfWeek),
      },
      order: { timestamp: 'ASC' },
    });

    if (snapshots.length === 0) {
      return {
        userId,
        weekStartDate,
        message: 'No data available for this week',
      };
    }

    const openingValue = Number(snapshots[0].totalValue);
    const closingValue = Number(snapshots[snapshots.length - 1].totalValue);
    const weeklyReturn = ((closingValue - openingValue) / openingValue) * 100;

    // Calculate daily returns for the week
    const dailyReturns: Array<{ date: Date; return: number }> = [];
    for (let i = 1; i < snapshots.length; i++) {
      const prevValue = Number(snapshots[i - 1].totalValue);
      const currentValue = Number(snapshots[i].totalValue);
      dailyReturns.push({
        date: snapshots[i].timestamp,
        return: ((currentValue - prevValue) / prevValue) * 100,
      });
    }

    return {
      userId,
      weekStartDate,
      openingValue,
      closingValue,
      weeklyReturn,
      dailyReturns,
      tradingDays: snapshots.length,
    };
  }

  async generateMonthlyReport(userId: number, month: number, year: number): Promise<any> {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const snapshots = await this.snapshotRepository.find({
      where: {
        userId,
        timestamp: Between(startOfMonth, endOfMonth),
      },
      order: { timestamp: 'ASC' },
    });

    if (snapshots.length === 0) {
      return {
        userId,
        month,
        year,
        message: 'No data available for this month',
      };
    }

    const openingValue = Number(snapshots[0].totalValue);
    const closingValue = Number(snapshots[snapshots.length - 1].totalValue);
    const monthlyReturn = ((closingValue - openingValue) / openingValue) * 100;

    // Get weekly performance
    const weeklySnapshots = this.groupByWeek(snapshots);

    return {
      userId,
      month,
      year,
      openingValue,
      closingValue,
      monthlyReturn,
      weeklyPerformance: weeklySnapshots,
      tradingDays: snapshots.length,
    };
  }

  async exportToCSV(userId: number, period: 'daily' | 'weekly' | 'monthly' = 'daily'): Promise<string> {
    const snapshots = await this.snapshotRepository.find({
      where: { userId },
      order: { timestamp: 'ASC' },
    });

    if (snapshots.length === 0) {
      throw new Error('No data available for export');
    }

    let csv = 'Date,Total Value,Profit/Loss,Returns\n';

    for (const snapshot of snapshots) {
      csv += `${snapshot.timestamp.toISOString()},${snapshot.totalValue},${
        snapshot.profitLoss || 0
      },${snapshot.returns || 0}\n`;
    }

    return csv;
  }

  async exportToJSON(userId: number, period: 'daily' | 'weekly' | 'monthly' = 'daily'): Promise<any> {
    const snapshots = await this.snapshotRepository.find({
      where: { userId },
      order: { timestamp: 'ASC' },
    });

    const riskMetrics = await this.riskMetricsRepository.findOne({
      where: { userId },
      order: { calculatedAt: 'DESC' },
    });

    return {
      userId,
      period,
      exportedAt: new Date(),
      snapshots,
      riskMetrics,
    };
  }

  async generateDashboardData(
    userId: number,
    period: 'daily' | 'weekly' | 'monthly' = 'daily',
  ): Promise<DashboardDataDto> {
    const snapshots = await this.snapshotRepository.find({
      where: { userId },
      order: { timestamp: 'DESC' },
      take: 30,
    });

    const riskMetrics = await this.riskMetricsRepository.findOne({
      where: { userId },
      order: { calculatedAt: 'DESC' },
    });

    if (snapshots.length === 0) {
      throw new Error('No portfolio data available');
    }

    const currentValue = Number(snapshots[0].totalValue);
    const previousValue = snapshots.length > 1 ? Number(snapshots[1].totalValue) : currentValue;
    
    const dailyReturn = previousValue > 0 ? ((currentValue - previousValue) / previousValue) * 100 : 0;

    // Calculate performance history
    const performanceHistory = snapshots.map(s => ({
      date: s.timestamp.toISOString(),
      value: Number(s.totalValue),
      return: Number(s.returns || 0),
    }));

    // Get latest asset allocation
    const latestAllocation = snapshots[0].assetAllocation || {};

    // Find top and worst performers
    const assetValues = snapshots[0].assetValues || {};
    const performers = Object.entries(assetValues)
      .map(([asset, value]) => ({
        asset,
        value: Number(value),
      }))
      .sort((a, b) => b.value - a.value);

    return {
      period,
      portfolioValue: currentValue,
      dailyReturn,
      weeklyReturn: dailyReturn * 7, // Simplified
      monthlyReturn: dailyReturn * 30, // Simplified
      totalReturn: ((currentValue - (snapshots[snapshots.length - 1] ? Number(snapshots[snapshots.length - 1].totalValue) : currentValue)) / 
        (snapshots[snapshots.length - 1] ? Number(snapshots[snapshots.length - 1].totalValue) : currentValue)) * 100,
      riskMetrics: {
        var95: Number(riskMetrics?.var95 || 0),
        sharpeRatio: Number(riskMetrics?.sharpeRatio || 0),
        maxDrawdown: Number(riskMetrics?.maxDrawdown || 0),
        volatility: Number(riskMetrics?.volatility || 0),
      },
      performanceHistory,
      assetAllocation: latestAllocation,
      topPerformers: performers.slice(0, 5).map(p => ({
        asset: p.asset,
        return: p.value,
      })),
      worstPerformers: performers.slice(-5).reverse().map(p => ({
        asset: p.asset,
        return: p.value,
      })),
    };
  }

  private groupByWeek(snapshots: PortfolioSnapshot[]): Array<{
    week: number;
    openingValue: number;
    closingValue: number;
    weeklyReturn: number;
  }> {
    const weeks: Map<number, PortfolioSnapshot[]> = new Map();

    for (const snapshot of snapshots) {
      const date = new Date(snapshot.timestamp);
      const weekNumber = this.getWeekNumber(date);
      
      if (!weeks.has(weekNumber)) {
        weeks.set(weekNumber, []);
      }
      weeks.get(weekNumber)!.push(snapshot);
    }

    const weeklyPerformance: Array<{
      week: number;
      openingValue: number;
      closingValue: number;
      weeklyReturn: number;
    }> = [];
    for (const [week, weekSnapshots] of weeks.entries()) {
      const openingValue = Number(weekSnapshots[0].totalValue);
      const closingValue = Number(weekSnapshots[weekSnapshots.length - 1].totalValue);
      const weeklyReturn = ((closingValue - openingValue) / openingValue) * 100;

      weeklyPerformance.push({
        week,
        openingValue,
        closingValue,
        weeklyReturn,
      });
    }

    return weeklyPerformance;
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }
}

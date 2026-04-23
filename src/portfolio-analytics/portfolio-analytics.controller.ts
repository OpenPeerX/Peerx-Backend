import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  ParseIntPipe,
  Res,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { PortfolioAnalyticsService } from './services/portfolio-analytics.service';
import { RiskCalculationService } from './services/risk-calculation.service';
import { ReportingService } from './services/reporting.service';
import { PerformancePeriod } from './entities/performance-history.entity';

@Controller('portfolio-analytics')
export class PortfolioAnalyticsController {
  private readonly logger = new Logger(PortfolioAnalyticsController.name);

  constructor(
    private readonly portfolioAnalyticsService: PortfolioAnalyticsService,
    private readonly riskCalculationService: RiskCalculationService,
    private readonly reportingService: ReportingService,
  ) {}

  @Get(':userId/value')
  async getPortfolioValue(@Param('userId', ParseIntPipe) userId: number) {
    return this.portfolioAnalyticsService.calculatePortfolioValue(userId);
  }

  @Get(':userId/performance')
  async getPerformanceMetrics(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('period') period: '1M' | '3M' | '6M' | '1Y' | 'ALL' = '1M',
  ) {
    return this.portfolioAnalyticsService.getPerformanceMetrics(userId, period);
  }

  @Get(':userId/risk-metrics')
  async getRiskMetrics(@Param('userId', ParseIntPipe) userId: number) {
    return this.riskCalculationService.getLatestRiskMetrics(userId);
  }

  @Get(':userId/var')
  async getVaR(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('confidence') confidence: '0.95' | '0.99' = '0.95',
  ) {
    const varValue = await this.riskCalculationService.calculateVaR(
      userId,
      parseFloat(confidence) as 0.95 | 0.99,
    );
    return { userId, confidence, var: varValue };
  }

  @Get(':userId/drawdown')
  async getDrawdown(@Param('userId', ParseIntPipe) userId: number) {
    const maxDrawdown = await this.riskCalculationService.calculateMaxDrawdown(userId);
    return { userId, maxDrawdown };
  }

  @Get(':userId/attribution')
  async getAttribution(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('period') period: string = '1M',
  ) {
    const allocation = await this.portfolioAnalyticsService.getAssetAllocation(userId);
    const performance = await this.portfolioAnalyticsService.getPerformanceMetrics(userId, period as any);

    return {
      userId,
      period,
      assetClassAttribution: Object.entries(allocation.allocation).map(([asset, weight]: [string, number]) => ({
        assetClass: asset,
        weight,
        contribution: (weight / 100) * performance.totalReturn,
        return: performance.totalReturn,
      })),
      totalReturn: performance.totalReturn,
    };
  }

  @Get(':userId/benchmark')
  async getBenchmarkComparison(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('benchmark') benchmark: string = 'BTC',
  ) {
    const performance = await this.portfolioAnalyticsService.getPerformanceMetrics(userId);
    const betaAlpha = await this.riskCalculationService.calculateBetaAndAlpha(userId, benchmark);

    return {
      userId,
      benchmark,
      portfolioReturn: performance.totalReturn,
      beta: betaAlpha.beta,
      alpha: betaAlpha.alpha,
    };
  }

  @Get(':userId/history')
  async getHistoricalPerformance(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('period') period: PerformancePeriod = PerformancePeriod.DAILY,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.portfolioAnalyticsService.getHistoricalPerformance(
      userId,
      period,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get(':userId/allocation')
  async getAssetAllocation(@Param('userId', ParseIntPipe) userId: number) {
    return this.portfolioAnalyticsService.getAssetAllocation(userId);
  }

  @Get(':userId/returns')
  async getReturns(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('period') period: '1M' | '3M' | '6M' | '1Y' | 'ALL' = '1M',
  ) {
    const performance = await this.portfolioAnalyticsService.getPerformanceMetrics(userId, period);
    return {
      userId,
      period,
      totalReturn: performance.totalReturn,
      annualizedReturn: performance.annualizedReturn,
    };
  }

  @Get(':userId/volatility')
  async getVolatility(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('period') period: '1M' | '3M' | '6M' | '1Y' = '1Y',
  ) {
    return this.riskCalculationService.calculateVolatility(userId, period);
  }

  @Get(':userId/sharpe')
  async getSharpeRatio(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('period') period: '1M' | '3M' | '6M' | '1Y' = '1Y',
  ) {
    const sharpeRatio = await this.riskCalculationService.calculateSharpeRatio(userId, period);
    return { userId, period, sharpeRatio };
  }

  @Get(':userId/sortino')
  async getSortinoRatio(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('period') period: '1M' | '3M' | '6M' | '1Y' = '1Y',
  ) {
    const sortinoRatio = await this.riskCalculationService.calculateSortinoRatio(userId, period);
    return { userId, period, sortinoRatio };
  }

  @Get(':userId/calmar')
  async getCalmarRatio(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('period') period: '1Y' | '2Y' | '3Y' = '1Y',
  ) {
    const calmarRatio = await this.riskCalculationService.calculateCalmarRatio(userId, period);
    return { userId, period, calmarRatio };
  }

  @Get(':userId/dashboard/:period')
  async getDashboardData(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('period') period: 'daily' | 'weekly' | 'monthly',
  ) {
    return this.reportingService.generateDashboardData(userId, period);
  }

  @Get(':userId/export/csv')
  async exportCSV(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('period') period: 'daily' | 'weekly' | 'monthly' = 'daily',
    @Res() res: Response,
  ) {
    const csv = await this.reportingService.exportToCSV(userId, period);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=portfolio-${userId}-${period}.csv`);
    res.send(csv);
  }

  @Get(':userId/export/json')
  async exportJSON(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('period') period: 'daily' | 'weekly' | 'monthly' = 'daily',
  ) {
    return this.reportingService.exportToJSON(userId, period);
  }

  @Get(':userId/export/pdf')
  async exportPDF(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('period') period: 'daily' | 'weekly' | 'monthly' = 'daily',
    @Res() res: Response,
  ) {
    const data = await this.reportingService.exportToJSON(userId, period);
    // In production, use a PDF library like pdfkit
    res.setHeader('Content-Type', 'application/json');
    res.send(data);
  }

  @Post(':userId/snapshot')
  async createSnapshot(@Param('userId', ParseIntPipe) userId: number) {
    return this.portfolioAnalyticsService.createSnapshot(userId);
  }

  @Get(':userId/snapshots')
  async getSnapshots(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.portfolioAnalyticsService.getSnapshots(
      userId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }
}

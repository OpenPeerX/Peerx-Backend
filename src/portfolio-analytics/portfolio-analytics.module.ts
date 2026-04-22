import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PortfolioAnalyticsController } from './portfolio-analytics.controller';
import { PortfolioAnalyticsService } from './services/portfolio-analytics.service';
import { RiskCalculationService } from './services/risk-calculation.service';
import { ReportingService } from './services/reporting.service';
import { PortfolioSnapshot } from './entities/portfolio-snapshot.entity';
import { RiskMetrics } from './entities/risk-metrics.entity';
import { PerformanceHistory } from './entities/performance-history.entity';
import { Benchmark } from './entities/benchmark.entity';
import { Portfolio } from '../portfolio/entities/portfolio.entity';
import { MarketData } from '../trading/entities/market-data.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PortfolioSnapshot,
      RiskMetrics,
      PerformanceHistory,
      Benchmark,
      Portfolio,
      MarketData,
    ]),
  ],
  controllers: [PortfolioAnalyticsController],
  providers: [PortfolioAnalyticsService, RiskCalculationService, ReportingService],
  exports: [PortfolioAnalyticsService, RiskCalculationService, ReportingService],
})
export class PortfolioAnalyticsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PortfolioOptimizationEntity } from './entities/portfolio-optimization.entity';
import { MarketPredictionEntity } from './entities/market-prediction.entity';
import { AIOptimizationController } from './controller/ai-optimization.controller';
import { PortfolioOptimizerService } from './services/portfolio-optimizer.service';
import { MLPredictionService } from './services/ml-prediction.service';
import { BacktestingService } from './services/backtesting.service';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PortfolioOptimizationEntity,
      MarketPredictionEntity,
    ]),
    ScheduleModule.forRoot(),
  ],
  controllers: [AIOptimizationController],
  providers: [
    PortfolioOptimizerService,
    MLPredictionService,
    BacktestingService,
  ],
  exports: [
    PortfolioOptimizerService,
    MLPredictionService,
    BacktestingService,
  ],
})
export class AIOptimizationModule {}

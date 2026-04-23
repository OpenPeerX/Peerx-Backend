import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketSurveillanceController } from './market-surveillance.controller';
import { PatternDetectionService } from './services/pattern-detection.service';
import { MLInferenceService } from './services/ml-inference.service';
import { AlertingService } from './services/alerting.service';
import { ActorThrottlingService } from './services/actor-throttling.service';
import { VisualizationService } from './services/visualization.service';
import { BacktestService } from './services/backtest.service';
import { AnomalyDetectionPipeline } from './services/anomaly-detection-pipeline.service';
import {
  AnomalyAlert,
  OrderBookSnapshot,
  SuspiciousActor,
  ViolationEvent,
  HeatmapMetric,
  PatternTemplate,
} from './entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AnomalyAlert,
      OrderBookSnapshot,
      SuspiciousActor,
      ViolationEvent,
      HeatmapMetric,
      PatternTemplate,
    ]),
  ],
  controllers: [MarketSurveillanceController],
  providers: [
    PatternDetectionService,
    MLInferenceService,
    AlertingService,
    ActorThrottlingService,
    VisualizationService,
    BacktestService,
    AnomalyDetectionPipeline,
  ],
  exports: [
    PatternDetectionService,
    MLInferenceService,
    AlertingService,
    ActorThrottlingService,
    VisualizationService,
    BacktestService,
    AnomalyDetectionPipeline,
  ],
})
export class MarketSurveillanceModule {}

import { Module } from '@nestjs/common';
import { PricePredictionController } from './controllers/price-prediction.controller';
import { LstmPriceModelService } from './models/lstm-price-model.service';
import { TransformerPriceModelService } from './models/transformer-price-model.service';
import { PricePredictionService } from './price-prediction.service';
import { BacktestingService } from './services/backtesting.service';
import { DataIngestionService } from './services/data-ingestion.service';
import { FeatureEngineeringService } from './services/feature-engineering.service';
import { ModelRegistryService } from './services/model-registry.service';
import { ModelRetrainingService } from './services/model-retraining.service';
import { PredictionCacheService } from './services/prediction-cache.service';
import { TradingSignalService } from './services/trading-signal.service';

@Module({
  controllers: [PricePredictionController],
  providers: [
    PricePredictionService,
    DataIngestionService,
    FeatureEngineeringService,
    LstmPriceModelService,
    TransformerPriceModelService,
    ModelRegistryService,
    PredictionCacheService,
    TradingSignalService,
    BacktestingService,
    ModelRetrainingService,
  ],
  exports: [PricePredictionService],
})
export class PricePredictionModule {}

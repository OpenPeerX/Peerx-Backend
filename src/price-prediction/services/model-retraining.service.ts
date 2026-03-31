import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { TOP_50_CRYPTO_SYMBOLS } from '../price-prediction.constants';
import { PricePredictionService } from '../price-prediction.service';

@Injectable()
export class ModelRetrainingService {
  private readonly logger = new Logger(ModelRetrainingService.name);

  constructor(private readonly predictionService: PricePredictionService) {}

  @Interval(30 * 60 * 1000)
  async retrainTopAssets(): Promise<void> {
    const symbols = TOP_50_CRYPTO_SYMBOLS.slice(0, 10);
    try {
      await this.predictionService.retrain(symbols, ['1m', '5m', '1h', '1d']);
      this.logger.log(`Scheduled retraining completed for ${symbols.length} assets`);
    } catch (error) {
      this.logger.error(`Scheduled retraining failed: ${error}`);
    }
  }
}

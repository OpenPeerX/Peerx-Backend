import { Injectable } from '@nestjs/common';
import {
  BacktestPoint,
  BacktestResult,
  EngineeredSample,
  ModelPrediction,
  PredictionTimeframe,
} from '../interfaces/price-prediction.interfaces';

@Injectable()
export class BacktestingService {
  evaluate(
    symbol: string,
    timeframe: PredictionTimeframe,
    samples: EngineeredSample[],
    horizonSteps: number,
    predictor: (slice: EngineeredSample[], steps: number) => ModelPrediction,
    modelVersion: string,
  ): BacktestResult {
    const points: BacktestPoint[] = [];
    const warmup = 60;
    const end = samples.length - horizonSteps - 1;

    for (let i = warmup; i < end; i += 1) {
      const history = samples.slice(0, i + 1);
      const forecast = predictor(history, horizonSteps);
      const basePrice = history[history.length - 1].close;
      const actualPrice = samples[i + horizonSteps].close;
      const absoluteError = Math.abs(actualPrice - forecast.predictedPrice);
      const percentageError = absoluteError / Math.max(actualPrice, 0.0001);

      points.push({
        timestamp: samples[i + horizonSteps].timestamp,
        actualPrice,
        predictedPrice: forecast.predictedPrice,
        absoluteError,
        percentageError,
        directionalHit:
          Math.sign(actualPrice - basePrice) === Math.sign(forecast.predictedPrice - basePrice),
      });
    }

    const mae = this.average(points.map((point) => point.absoluteError));
    const rmse = Math.sqrt(this.average(points.map((point) => Math.pow(point.absoluteError, 2))));
    const mape = this.average(points.map((point) => point.percentageError));
    const directionalAccuracy = this.average(
      points.map((point) => (point.directionalHit ? 1 : 0)),
    );
    const confidenceCalibrationError = Math.min(1, Math.abs(directionalAccuracy - (1 - mape)));

    return {
      symbol,
      timeframe,
      evaluatedPoints: points.length,
      mae,
      rmse,
      mape,
      directionalAccuracy,
      coverage: points.length > 0 ? 1 : 0,
      confidenceCalibrationError,
      points,
      modelVersion,
      generatedAt: new Date().toISOString(),
    };
  }

  private average(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }
}

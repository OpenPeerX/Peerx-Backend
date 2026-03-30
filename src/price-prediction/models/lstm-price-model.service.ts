import { Injectable } from '@nestjs/common';
import {
  EngineeredSample,
  ModelPrediction,
  ModelTrainingSummary,
  PredictionModel,
} from '../interfaces/price-prediction.interfaces';

@Injectable()
export class LstmPriceModelService implements PredictionModel {
  readonly modelType = 'lstm' as const;

  private version = 'lstm_v0';
  private decayFactor = 0.82;
  private momentumWeight = 0.4;
  private lastValidationMae = 0.02;
  private lastDirectionalAccuracy = 0.5;

  train(samples: EngineeredSample[]): ModelTrainingSummary {
    const candidateDecays = [0.65, 0.72, 0.78, 0.82, 0.86, 0.9, 0.94];
    const candidateMomentumWeights = [0.1, 0.25, 0.4, 0.55, 0.7];

    let bestMae = Number.POSITIVE_INFINITY;
    let bestDirectional = 0;
    let bestDecay = this.decayFactor;
    let bestMomentum = this.momentumWeight;

    for (const decay of candidateDecays) {
      for (const momentum of candidateMomentumWeights) {
        const metrics = this.evaluateHyperParams(samples, decay, momentum);
        if (metrics.mae < bestMae) {
          bestMae = metrics.mae;
          bestDirectional = metrics.directionalAccuracy;
          bestDecay = decay;
          bestMomentum = momentum;
        }
      }
    }

    this.decayFactor = bestDecay;
    this.momentumWeight = bestMomentum;
    this.lastValidationMae = bestMae;
    this.lastDirectionalAccuracy = bestDirectional;
    this.version = `lstm_v${Date.now()}`;

    return {
      modelType: this.modelType,
      version: this.version,
      trainedAt: new Date().toISOString(),
      sampleCount: samples.length,
      trainingLoss: bestMae,
      validationMae: bestMae,
      validationDirectionalAccuracy: bestDirectional,
    };
  }

  predict(samples: EngineeredSample[], horizonSteps: number): ModelPrediction {
    if (samples.length < 8) {
      const fallback = samples[samples.length - 1]?.close ?? 0;
      return {
        modelType: this.modelType,
        version: this.version,
        predictedPrice: fallback,
        expectedReturn: 0,
        confidence: 40,
      };
    }

    const closeSeries = samples.map((sample) => sample.close);
    const latest = closeSeries[closeSeries.length - 1];
    const weightedReturn = this.computeWeightedReturn(closeSeries);
    const volatility = this.rollingVolatility(closeSeries);
    const horizonScaledReturn = weightedReturn * Math.min(horizonSteps, 10);
    const momentumFeature = samples[samples.length - 1].features[4] ?? 0;

    const projectedReturn = horizonScaledReturn + this.momentumWeight * momentumFeature;
    const predictedPrice = Math.max(0.0001, latest * (1 + projectedReturn));
    const confidence = this.computeConfidence(volatility);

    return {
      modelType: this.modelType,
      version: this.version,
      predictedPrice,
      expectedReturn: projectedReturn,
      confidence,
    };
  }

  private evaluateHyperParams(
    samples: EngineeredSample[],
    decayFactor: number,
    momentumWeight: number,
  ): { mae: number; directionalAccuracy: number } {
    const closes = samples.map((sample) => sample.close);
    const start = Math.max(10, Math.floor(closes.length * 0.7));

    let mae = 0;
    let hits = 0;
    let total = 0;

    for (let i = start; i < closes.length - 1; i += 1) {
      const history = closes.slice(0, i + 1);
      const predictedReturn =
        this.computeWeightedReturn(history, decayFactor) + momentumWeight * (samples[i].features[4] ?? 0);
      const predictedPrice = history[history.length - 1] * (1 + predictedReturn);
      const actual = closes[i + 1];

      mae += Math.abs(actual - predictedPrice);
      const actualDirection = Math.sign(actual - history[history.length - 1]);
      const predictedDirection = Math.sign(predictedPrice - history[history.length - 1]);
      if (actualDirection === predictedDirection) {
        hits += 1;
      }
      total += 1;
    }

    return {
      mae: total > 0 ? mae / total : 1,
      directionalAccuracy: total > 0 ? hits / total : 0.5,
    };
  }

  private computeWeightedReturn(closes: number[], decay = this.decayFactor): number {
    let weightedSum = 0;
    let weightTotal = 0;

    for (let i = closes.length - 1; i > 0 && closes.length - i <= 12; i -= 1) {
      const weight = Math.pow(decay, closes.length - i - 1);
      const ret = (closes[i] - closes[i - 1]) / Math.max(closes[i - 1], 0.0001);
      weightedSum += ret * weight;
      weightTotal += weight;
    }

    return weightTotal > 0 ? weightedSum / weightTotal : 0;
  }

  private rollingVolatility(closes: number[]): number {
    const returns: number[] = [];
    for (let i = Math.max(1, closes.length - 15); i < closes.length; i += 1) {
      returns.push((closes[i] - closes[i - 1]) / Math.max(closes[i - 1], 0.0001));
    }
    const mean = returns.reduce((sum, value) => sum + value, 0) / Math.max(returns.length, 1);
    const variance =
      returns.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / Math.max(returns.length, 1);
    return Math.sqrt(variance);
  }

  private computeConfidence(volatility: number): number {
    const stabilityScore = Math.max(0, 1 - volatility * 22);
    const calibration = Math.max(0, 1 - this.lastValidationMae);
    const directional = this.lastDirectionalAccuracy;
    return Math.round(Math.max(30, Math.min(98, (stabilityScore * 0.35 + calibration * 0.35 + directional * 0.3) * 100)));
  }
}

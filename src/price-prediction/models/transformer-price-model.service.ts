import { Injectable } from '@nestjs/common';
import {
  EngineeredSample,
  ModelPrediction,
  ModelTrainingSummary,
  PredictionModel,
} from '../interfaces/price-prediction.interfaces';

@Injectable()
export class TransformerPriceModelService implements PredictionModel {
  readonly modelType = 'transformer' as const;

  private version = 'transformer_v0';
  private lagWeights: number[] = [0.35, 0.25, 0.2, 0.12, 0.08];
  private macroWeight = 0.1;
  private sentimentWeight = 0.15;
  private lastValidationMae = 0.02;
  private lastDirectionalAccuracy = 0.5;

  train(samples: EngineeredSample[]): ModelTrainingSummary {
    const candidates = [
      [0.45, 0.2, 0.15, 0.12, 0.08],
      [0.35, 0.25, 0.2, 0.12, 0.08],
      [0.3, 0.24, 0.2, 0.16, 0.1],
      [0.25, 0.22, 0.2, 0.18, 0.15],
    ];
    const macroCandidates = [0.05, 0.1, 0.2];
    const sentimentCandidates = [0.05, 0.1, 0.15, 0.2];

    let bestMae = Number.POSITIVE_INFINITY;
    let bestDirectional = 0;
    let bestWeights = this.lagWeights;
    let bestMacro = this.macroWeight;
    let bestSentiment = this.sentimentWeight;

    for (const lagWeights of candidates) {
      for (const macroWeight of macroCandidates) {
        for (const sentimentWeight of sentimentCandidates) {
          const metrics = this.evaluateParams(samples, lagWeights, macroWeight, sentimentWeight);
          if (metrics.mae < bestMae) {
            bestMae = metrics.mae;
            bestDirectional = metrics.directionalAccuracy;
            bestWeights = lagWeights;
            bestMacro = macroWeight;
            bestSentiment = sentimentWeight;
          }
        }
      }
    }

    this.lagWeights = bestWeights;
    this.macroWeight = bestMacro;
    this.sentimentWeight = bestSentiment;
    this.lastValidationMae = bestMae;
    this.lastDirectionalAccuracy = bestDirectional;
    this.version = `transformer_v${Date.now()}`;

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
    if (samples.length < 12) {
      const fallback = samples[samples.length - 1]?.close ?? 0;
      return {
        modelType: this.modelType,
        version: this.version,
        predictedPrice: fallback,
        expectedReturn: 0,
        confidence: 38,
      };
    }

    const closeSeries = samples.map((sample) => sample.close);
    const latest = closeSeries[closeSeries.length - 1];
    const weightedAttention = this.computeAttentionReturn(closeSeries, this.lagWeights);
    const lastFeatures = samples[samples.length - 1].features;
    const macroImpact = (lastFeatures[18] - 0.5) * this.macroWeight;
    const sentimentImpact = (lastFeatures[9] - 0.5) * this.sentimentWeight;
    const projectedReturn = (weightedAttention + macroImpact + sentimentImpact) * Math.min(horizonSteps, 12);
    const predictedPrice = Math.max(0.0001, latest * (1 + projectedReturn));
    const confidence = this.computeConfidence(samples);

    return {
      modelType: this.modelType,
      version: this.version,
      predictedPrice,
      expectedReturn: projectedReturn,
      confidence,
    };
  }

  private evaluateParams(
    samples: EngineeredSample[],
    lagWeights: number[],
    macroWeight: number,
    sentimentWeight: number,
  ): { mae: number; directionalAccuracy: number } {
    const closes = samples.map((sample) => sample.close);
    const start = Math.max(15, Math.floor(closes.length * 0.7));
    let mae = 0;
    let hits = 0;
    let total = 0;

    for (let i = start; i < closes.length - 1; i += 1) {
      const history = closes.slice(0, i + 1);
      const attentionReturn = this.computeAttentionReturn(history, lagWeights);
      const macro = (samples[i].features[18] - 0.5) * macroWeight;
      const sentiment = (samples[i].features[9] - 0.5) * sentimentWeight;
      const forecastReturn = attentionReturn + macro + sentiment;
      const forecastPrice = history[history.length - 1] * (1 + forecastReturn);
      const actual = closes[i + 1];
      mae += Math.abs(actual - forecastPrice);

      const actualDirection = Math.sign(actual - history[history.length - 1]);
      const predictedDirection = Math.sign(forecastPrice - history[history.length - 1]);
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

  private computeAttentionReturn(closes: number[], lagWeights: number[]): number {
    const returns: number[] = [];
    for (let lag = 1; lag <= lagWeights.length; lag += 1) {
      const latest = closes[closes.length - lag];
      const prior = closes[closes.length - lag - 1] ?? latest;
      returns.push((latest - prior) / Math.max(prior, 0.0001));
    }

    return lagWeights.reduce((sum, weight, index) => sum + weight * (returns[index] ?? 0), 0);
  }

  private computeConfidence(samples: EngineeredSample[]): number {
    const closes = samples.slice(-20).map((sample) => sample.close);
    let avgAbsMove = 0;
    for (let i = 1; i < closes.length; i += 1) {
      avgAbsMove += Math.abs((closes[i] - closes[i - 1]) / Math.max(closes[i - 1], 0.0001));
    }
    avgAbsMove /= Math.max(closes.length - 1, 1);

    const stability = Math.max(0, 1 - avgAbsMove * 18);
    const calibration = Math.max(0, 1 - this.lastValidationMae);
    const score = stability * 0.4 + calibration * 0.35 + this.lastDirectionalAccuracy * 0.25;
    return Math.round(Math.max(30, Math.min(98, score * 100)));
  }
}

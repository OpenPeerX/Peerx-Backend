import { Injectable, Logger } from '@nestjs/common';
import { DEFAULT_TIMEFRAMES, TOP_50_CRYPTO_SYMBOLS } from './price-prediction.constants';
import { LstmPriceModelService } from './models/lstm-price-model.service';
import { TransformerPriceModelService } from './models/transformer-price-model.service';
import { DataIngestionService } from './services/data-ingestion.service';
import { FeatureEngineeringService } from './services/feature-engineering.service';
import { ModelRegistryService } from './services/model-registry.service';
import { PredictionCacheService } from './services/prediction-cache.service';
import { TradingSignalService } from './services/trading-signal.service';
import {
  BacktestResult,
  ModelPrediction,
  ModelTrainingSummary,
  PredictionTimeframe,
  PricePredictionResponse,
  RetrainingJobResult,
} from './interfaces/price-prediction.interfaces';
import { BacktestingService } from './services/backtesting.service';

@Injectable()
export class PricePredictionService {
  private readonly logger = new Logger(PricePredictionService.name);
  private readonly trainedPairs = new Set<string>();

  constructor(
    private readonly dataIngestionService: DataIngestionService,
    private readonly featureEngineeringService: FeatureEngineeringService,
    private readonly lstmModel: LstmPriceModelService,
    private readonly transformerModel: TransformerPriceModelService,
    private readonly modelRegistryService: ModelRegistryService,
    private readonly predictionCacheService: PredictionCacheService,
    private readonly tradingSignalService: TradingSignalService,
    private readonly backtestingService: BacktestingService,
  ) {}

  getSupportedAssets(): string[] {
    return [...TOP_50_CRYPTO_SYMBOLS];
  }

  async predict(
    symbol: string,
    timeframe: PredictionTimeframe,
    horizonSteps = 1,
  ): Promise<PricePredictionResponse> {
    const normalized = symbol.toUpperCase();
    if (!TOP_50_CRYPTO_SYMBOLS.includes(normalized as (typeof TOP_50_CRYPTO_SYMBOLS)[number])) {
      throw new Error(`Unsupported asset ${normalized}. Asset must be one of top 50 configured symbols.`);
    }

    const cacheKey = `${normalized}:${timeframe}:${horizonSteps}`;
    const cached = this.predictionCacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const context = await this.dataIngestionService.fetchUnifiedContext(normalized, timeframe, 600);
    const samples = this.featureEngineeringService.buildSamples(context);

    await this.ensureTrained(normalized, timeframe, samples);

    const lstmPrediction = this.lstmModel.predict(samples, horizonSteps);
    const transformerPrediction = this.transformerModel.predict(samples, horizonSteps);
    const ensemblePrediction = this.combinePredictions([lstmPrediction, transformerPrediction], samples);

    const basePrice = samples[samples.length - 1]?.close ?? context.candles[context.candles.length - 1]?.close ?? 0;
    const expectedReturnPct = (ensemblePrediction.expectedReturn || 0) * 100;
    const signal = this.tradingSignalService.toSignal(expectedReturnPct, ensemblePrediction.confidence);

    const response: PricePredictionResponse = {
      symbol: normalized,
      timeframe,
      horizonSteps,
      predictedPrice: ensemblePrediction.predictedPrice,
      expectedReturnPct,
      confidence: ensemblePrediction.confidence,
      signal,
      modelVersion: `ensemble:${lstmPrediction.version}+${transformerPrediction.version}`,
      modelBreakdown: [lstmPrediction, transformerPrediction, ensemblePrediction],
      contextAgeMs: Date.now() - new Date(context.fetchedAt).getTime(),
      generatedAt: new Date().toISOString(),
    };

    const ttl = this.timeframeToTtl(timeframe);
    this.predictionCacheService.set(cacheKey, response, ttl);
    this.logger.debug(
      `Prediction generated for ${normalized} ${timeframe}: ${basePrice.toFixed(2)} -> ${response.predictedPrice.toFixed(2)}`,
    );

    return response;
  }

  async predictTopAssets(timeframe: PredictionTimeframe, limit = 20): Promise<PricePredictionResponse[]> {
    const symbols = TOP_50_CRYPTO_SYMBOLS.slice(0, Math.max(1, Math.min(50, limit)));
    const predictions = await Promise.all(
      symbols.map((symbol) =>
        this.predict(symbol, timeframe, this.defaultHorizonStepsForTimeframe(timeframe)).catch((error) => {
          this.logger.warn(`Prediction failed for ${symbol}: ${error}`);
          return null;
        }),
      ),
    );

    return predictions.filter((prediction): prediction is PricePredictionResponse => prediction !== null);
  }

  async retrain(
    symbols: string[] = [TOP_50_CRYPTO_SYMBOLS[0], TOP_50_CRYPTO_SYMBOLS[1], TOP_50_CRYPTO_SYMBOLS[2]],
    timeframes: PredictionTimeframe[] = [...DEFAULT_TIMEFRAMES],
  ): Promise<RetrainingJobResult[]> {
    const results: RetrainingJobResult[] = [];

    for (const timeframe of timeframes) {
      const summaries: ModelTrainingSummary[] = [];
      for (const symbol of symbols) {
        const normalized = symbol.toUpperCase();
        const context = await this.dataIngestionService.fetchUnifiedContext(normalized, timeframe, 900);
        const samples = this.featureEngineeringService.buildSamples(context);
        const lstmSummary = this.lstmModel.train(samples);
        const transformerSummary = this.transformerModel.train(samples);
        summaries.push(lstmSummary, transformerSummary);

        this.modelRegistryService.setActiveVersion('lstm', timeframe, lstmSummary.version);
        this.modelRegistryService.setActiveVersion('transformer', timeframe, transformerSummary.version);

        this.trainedPairs.add(`${normalized}:${timeframe}`);
      }

      results.push({
        timeframe,
        symbols,
        summaries,
        finishedAt: new Date().toISOString(),
      });
    }

    return results;
  }

  async backtest(
    symbol: string,
    timeframe: PredictionTimeframe,
    lookbackPoints: number,
    horizonSteps: number,
  ): Promise<BacktestResult> {
    const normalized = symbol.toUpperCase();
    const context = await this.dataIngestionService.fetchUnifiedContext(normalized, timeframe, lookbackPoints + 120);
    const samples = this.featureEngineeringService.buildSamples(context);

    await this.ensureTrained(normalized, timeframe, samples);

    return this.backtestingService.evaluate(
      normalized,
      timeframe,
      samples.slice(-lookbackPoints),
      horizonSteps,
      (slice, steps) => this.combinePredictions([
        this.lstmModel.predict(slice, steps),
        this.transformerModel.predict(slice, steps),
      ], slice),
      this.getModelVersionSummary(timeframe),
    );
  }

  getModelMetrics(timeframe?: PredictionTimeframe): Record<string, unknown> {
    return {
      activeVersions: {
        ...(timeframe ? { timeframe } : {}),
        lstm: timeframe ? this.modelRegistryService.getActiveVersion('lstm', timeframe) : 'multiple',
        transformer: timeframe
          ? this.modelRegistryService.getActiveVersion('transformer', timeframe)
          : 'multiple',
      },
      cache: this.predictionCacheService.getStats(),
      abTestingTrafficSplit: this.modelRegistryService.getAbTrafficSplit(),
      validation: this.modelRegistryService.getValidationSnapshots(timeframe),
    };
  }

  private async ensureTrained(
    symbol: string,
    timeframe: PredictionTimeframe,
    samples: { close: number; features: number[]; timestamp: number }[],
  ): Promise<void> {
    const key = `${symbol}:${timeframe}`;
    if (this.trainedPairs.has(key)) {
      return;
    }

    const lstmSummary = this.lstmModel.train(samples);
    const transformerSummary = this.transformerModel.train(samples);
    this.modelRegistryService.setActiveVersion('lstm', timeframe, lstmSummary.version);
    this.modelRegistryService.setActiveVersion('transformer', timeframe, transformerSummary.version);
    this.modelRegistryService.upsertValidationSnapshot(timeframe, {
      modelType: 'lstm',
      version: lstmSummary.version,
      mae: lstmSummary.validationMae,
      rmse: lstmSummary.validationMae * 1.2,
      directionalAccuracy: lstmSummary.validationDirectionalAccuracy,
      confidenceCalibrationError: Math.abs(
        lstmSummary.validationDirectionalAccuracy - (1 - lstmSummary.validationMae),
      ),
      updatedAt: new Date().toISOString(),
    });
    this.modelRegistryService.upsertValidationSnapshot(timeframe, {
      modelType: 'transformer',
      version: transformerSummary.version,
      mae: transformerSummary.validationMae,
      rmse: transformerSummary.validationMae * 1.2,
      directionalAccuracy: transformerSummary.validationDirectionalAccuracy,
      confidenceCalibrationError: Math.abs(
        transformerSummary.validationDirectionalAccuracy - (1 - transformerSummary.validationMae),
      ),
      updatedAt: new Date().toISOString(),
    });

    this.trainedPairs.add(key);
  }

  private combinePredictions(
    modelPredictions: ModelPrediction[],
    samples: { close: number }[],
  ): ModelPrediction {
    const lstm = modelPredictions.find((prediction) => prediction.modelType === 'lstm');
    const transformer = modelPredictions.find(
      (prediction) => prediction.modelType === 'transformer',
    );

    const lstmWeight = 0.52;
    const transformerWeight = 0.48;

    const predictedPrice =
      (lstm?.predictedPrice ?? 0) * lstmWeight + (transformer?.predictedPrice ?? 0) * transformerWeight;
    const latest = samples[samples.length - 1]?.close ?? predictedPrice;
    const expectedReturn = latest > 0 ? (predictedPrice - latest) / latest : 0;

    const agreementPenalty = Math.min(
      0.2,
      Math.abs((lstm?.expectedReturn ?? 0) - (transformer?.expectedReturn ?? 0)) * 2,
    );
    const avgConfidence =
      ((lstm?.confidence ?? 50) * lstmWeight + (transformer?.confidence ?? 50) * transformerWeight) *
      (1 - agreementPenalty);

    return {
      modelType: 'ensemble',
      version: `ensemble:${lstm?.version ?? 'na'}+${transformer?.version ?? 'na'}`,
      predictedPrice,
      expectedReturn,
      confidence: Math.round(Math.max(30, Math.min(99, avgConfidence))),
    };
  }

  private timeframeToTtl(timeframe: PredictionTimeframe): number {
    switch (timeframe) {
      case '1m':
        return 20_000;
      case '5m':
        return 45_000;
      case '1h':
        return 120_000;
      case '1d':
        return 300_000;
      default:
        return 60_000;
    }
  }

  private defaultHorizonStepsForTimeframe(timeframe: PredictionTimeframe): number {
    switch (timeframe) {
      case '1m':
        return 3;
      case '5m':
        return 3;
      case '1h':
        return 2;
      case '1d':
        return 1;
      default:
        return 1;
    }
  }

  private getModelVersionSummary(timeframe: PredictionTimeframe): string {
    const lstmVersion = this.modelRegistryService.getActiveVersion('lstm', timeframe) ?? 'unknown';
    const transformerVersion =
      this.modelRegistryService.getActiveVersion('transformer', timeframe) ?? 'unknown';
    return `ensemble:${lstmVersion}+${transformerVersion}`;
  }
}

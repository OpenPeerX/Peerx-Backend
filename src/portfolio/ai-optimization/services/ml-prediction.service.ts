import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketPredictionEntity, PredictionType, PredictionHorizon } from '../entities/market-prediction.entity';
import { Cron, CronExpression } from '@nestjs/schedule';

interface MarketData {
  symbol: string;
  price: number;
  volume: number;
  timestamp: Date;
  technicalIndicators?: Record<string, number>;
}

interface FeatureSet {
  price: number;
  volume: number;
  movingAverages: Record<string, number>;
  rsi: number;
  macd: number;
  bollingerBands: Record<string, number>;
  volatility: number;
  momentum: number;
}

@Injectable()
export class MLPredictionService {
  private readonly logger = new Logger(MLPredictionService.name);
  private readonly modelCache = new Map<string, any>();

  constructor(
    @InjectRepository(MarketPredictionEntity)
    private readonly predictionRepository: Repository<MarketPredictionEntity>,
  ) {}

  async generatePricePredictions(
    symbols: string[],
    horizon: PredictionHorizon,
  ): Promise<MarketPredictionEntity[]> {
    const predictions: MarketPredictionEntity[] = [];

    for (const symbol of symbols) {
      try {
        const prediction = await this.predictAssetPrice(symbol, horizon);
        predictions.push(prediction);
      } catch (error) {
        this.logger.error(`Failed to generate prediction for ${symbol}:`, error);
      }
    }

    return predictions;
  }

  private async predictAssetPrice(
    symbol: string,
    horizon: PredictionHorizon,
  ): Promise<MarketPredictionEntity> {
    // Fetch historical data and features
    const features = await this.extractFeatures(symbol);
    
    // Simple linear regression for demonstration
    // In production, this would use more sophisticated ML models
    const prediction = this.linearRegressionPredict(features, horizon);
    
    const confidence = this.calculatePredictionConfidence(features, horizon);
    
    const predictionEntity = this.predictionRepository.create({
      assetSymbol: symbol,
      predictionType: PredictionType.PRICE,
      horizon,
      predictedValue: prediction.price,
      confidence,
      upperBound: prediction.upperBound,
      lowerBound: prediction.lowerBound,
      features,
      predictionDate: new Date(),
      targetDate: this.calculateTargetDate(horizon),
      modelVersion: '1.0.0',
      modelMetadata: {
        algorithm: 'linear_regression',
        featuresUsed: Object.keys(features),
        trainingPeriod: '1y',
      },
    });

    return this.predictionRepository.save(predictionEntity);
  }

  private async extractFeatures(symbol: string): Promise<FeatureSet> {
    // This would fetch real market data from external APIs
    // For demonstration, we'll use mock data
    const mockData = await this.getMockMarketData(symbol);
    
    return {
      price: mockData.price,
      volume: mockData.volume,
      movingAverages: this.calculateMovingAverages(mockData),
      rsi: this.calculateRSI(mockData),
      macd: this.calculateMACD(mockData),
      bollingerBands: this.calculateBollingerBands(mockData),
      volatility: this.calculateVolatility(mockData),
      momentum: this.calculateMomentum(mockData),
    };
  }

  private linearRegressionPredict(
    features: FeatureSet,
    horizon: PredictionHorizon,
  ): { price: number; upperBound: number; lowerBound: number } {
    // Simplified linear regression
    // In production, this would be a proper ML model
    const trendFactor = features.momentum * 0.1;
    const volatilityFactor = features.volatility * 0.2;
    const rsiAdjustment = (features.rsi - 50) * 0.01;
    
    const horizonMultiplier = this.getHorizonMultiplier(horizon);
    const predictedReturn = (trendFactor + volatilityFactor + rsiAdjustment) * horizonMultiplier;
    
    const predictedPrice = features.price * (1 + predictedReturn);
    const confidenceInterval = predictedPrice * features.volatility * 0.05;
    
    return {
      price: predictedPrice,
      upperBound: predictedPrice + confidenceInterval,
      lowerBound: predictedPrice - confidenceInterval,
    };
  }

  private calculatePredictionConfidence(features: FeatureSet, horizon: PredictionHorizon): number {
    // Confidence decreases with longer horizons and higher volatility
    const baseConfidence = 0.85;
    const volatilityPenalty = features.volatility * 0.5;
    const horizonPenalty = this.getHorizonPenalty(horizon);
    
    return Math.max(0.5, Math.min(0.95, baseConfidence - volatilityPenalty - horizonPenalty));
  }

  private getHorizonMultiplier(horizon: PredictionHorizon): number {
    const multipliers = {
      [PredictionHorizon.ONE_DAY]: 1,
      [PredictionHorizon.ONE_WEEK]: 7,
      [PredictionHorizon.ONE_MONTH]: 30,
      [PredictionHorizon.THREE_MONTHS]: 90,
      [PredictionHorizon.SIX_MONTHS]: 180,
      [PredictionHorizon.ONE_YEAR]: 365,
    };
    return multipliers[horizon] / 365; // Convert to years
  }

  private getHorizonPenalty(horizon: PredictionHorizon): number {
    const penalties = {
      [PredictionHorizon.ONE_DAY]: 0.05,
      [PredictionHorizon.ONE_WEEK]: 0.10,
      [PredictionHorizon.ONE_MONTH]: 0.15,
      [PredictionHorizon.THREE_MONTHS]: 0.20,
      [PredictionHorizon.SIX_MONTHS]: 0.25,
      [PredictionHorizon.ONE_YEAR]: 0.30,
    };
    return penalties[horizon];
  }

  private calculateTargetDate(horizon: PredictionHorizon): Date {
    const now = new Date();
    const days = {
      [PredictionHorizon.ONE_DAY]: 1,
      [PredictionHorizon.ONE_WEEK]: 7,
      [PredictionHorizon.ONE_MONTH]: 30,
      [PredictionHorizon.THREE_MONTHS]: 90,
      [PredictionHorizon.SIX_MONTHS]: 180,
      [PredictionHorizon.ONE_YEAR]: 365,
    };
    
    return new Date(now.getTime() + days[horizon] * 24 * 60 * 60 * 1000);
  }

  // Mock data methods - in production, these would fetch real market data
  private async getMockMarketData(symbol: string): Promise<MarketData> {
    // Generate realistic mock data based on symbol
    const basePrice = symbol === 'BTC' ? 45000 : symbol === 'ETH' ? 3000 : 100;
    const randomVariation = (Math.random() - 0.5) * 0.1;
    
    return {
      symbol,
      price: basePrice * (1 + randomVariation),
      volume: Math.random() * 1000000,
      timestamp: new Date(),
      technicalIndicators: {},
    };
  }

  private calculateMovingAverages(data: MarketData): Record<string, number> {
    // Simplified moving average calculation
    return {
      ma20: data.price * (1 + (Math.random() - 0.5) * 0.05),
      ma50: data.price * (1 + (Math.random() - 0.5) * 0.08),
      ma200: data.price * (1 + (Math.random() - 0.5) * 0.12),
    };
  }

  private calculateRSI(data: MarketData): number {
    // Simplified RSI calculation
    return 30 + Math.random() * 40; // Random RSI between 30-70
  }

  private calculateMACD(data: MarketData): number {
    // Simplified MACD calculation
    return (Math.random() - 0.5) * 2;
  }

  private calculateBollingerBands(data: MarketData): Record<string, number> {
    const stdDev = data.price * 0.02;
    return {
      upper: data.price + 2 * stdDev,
      middle: data.price,
      lower: data.price - 2 * stdDev,
    };
  }

  private calculateVolatility(data: MarketData): number {
    // Simplified volatility calculation (annualized)
    return 0.15 + Math.random() * 0.25; // 15% to 40% annual volatility
  }

  private calculateMomentum(data: MarketData): number {
    // Simplified momentum calculation
    return (Math.random() - 0.5) * 0.1;
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async updateDailyPredictions(): Promise<void> {
    this.logger.log('Updating daily market predictions...');
    
    const symbols = ['BTC', 'ETH', 'AAPL', 'GOOGL', 'MSFT']; // Common assets
    await this.generatePricePredictions(symbols, PredictionHorizon.ONE_DAY);
    
    this.logger.log('Daily predictions updated successfully');
  }

  async getPredictionAccuracy(symbol: string, horizon: PredictionHorizon): Promise<number> {
    const predictions = await this.predictionRepository.find({
      where: {
        assetSymbol: symbol,
        horizon,
        actualValue: { $ne: null },
      },
      order: { createdAt: 'DESC' },
      take: 100,
    });

    if (predictions.length === 0) {
      return 0;
    }

    const totalAccuracy = predictions.reduce((sum, pred) => {
      const accuracy = pred.accuracy || 0;
      return sum + accuracy;
    }, 0);

    return totalAccuracy / predictions.length;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnomalyAlert, AnomalyType, SeverityLevel } from '../entities/anomaly-alert.entity';
import { PatternTemplate } from '../entities/pattern-template.entity';

/**
 * Represents a machine learning model for anomaly detection
 */
export interface MLModel {
  id: string;
  type: string; // RANDOM_FOREST, NEURAL_NETWORK, XG_BOOST, ISOLATION_FOREST
  version: string;
  features: string[];
  trainingMetrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    auc: number;
  };
  isActive: boolean;
}

/**
 * Input features for ML model scoring
 */
export interface DetectionFeatures {
  // Order characteristics
  orderSize: number;
  orderDuration: number;
  cancellationRate: number;
  
  // Market characteristics
  bidAskSpread: number;
  bidAskImbalance: number;
  volatility: number;
  volume: number;
  
  // Temporal
  timeOfDay: number;
  dayOfWeek: number;
  
  // Actor history
  actorHistoricalCancellationRate: number;
  actorHistoricalViolations: number;
  actorTradeFrequency: number;
  
  // Pattern indicators
  spoofingIndicator: number; // 0-1
  layeringIndicator: number; // 0-1
  washTradingIndicator: number; // 0-1
  pumpDumpIndicator: number; // 0-1
  quoteSuffingIndicator: number; // 0-1
  
  // Contextual
  marketStress: number; // 0-1
  liquidityScore: number; // 0-1
  priceDeviation: number; // % from normal
}

export interface MLScoreResult {
  anomalyProbability: number; // 0-1
  anomalyType: AnomalyType;
  severity: SeverityLevel;
  confidence: number; // 0-100
  featureImportance: Record<string, number>;
  modelId: string;
  modelVersion: string;
  explanation: string;
  isEnsemblePrediction: boolean;
  ensembleModels?: string[];
}

@Injectable()
export class MLInferenceService {
  private readonly logger = new Logger(MLInferenceService.name);
  
  // Simulated ML models (in production, these would load actual ML models)
  private models: Map<string, MLModel> = new Map();
  
  // Feature scaling parameters (learned from training data)
  private featureScalers: Map<string, { mean: number; std: number }> = new Map();

  constructor(
    @InjectRepository(AnomalyAlert)
    private anomalyAlertRepository: Repository<AnomalyAlert>,
    @InjectRepository(PatternTemplate)
    private patternTemplateRepository: Repository<PatternTemplate>,
  ) {
    this.initializeModels();
    this.initializeFeatureScalers();
  }

  /**
   * Initialize ML models
   */
  private initializeModels(): void {
    // Random Forest Model
    this.models.set('rf_v1', {
      id: 'rf_v1',
      type: 'RANDOM_FOREST',
      version: '1.0',
      features: [
        'orderSize', 'cancellationRate', 'bidAskImbalance',
        'spoofingIndicator', 'actorHistoricalViolations'
      ],
      trainingMetrics: {
        accuracy: 0.94,
        precision: 0.91,
        recall: 0.89,
        f1Score: 0.90,
        auc: 0.96,
      },
      isActive: true,
    });

    // Neural Network Model
    this.models.set('nn_v1', {
      id: 'nn_v1',
      type: 'NEURAL_NETWORK',
      version: '1.0',
      features: [
        'orderSize', 'orderDuration', 'cancellationRate',
        'bidAskSpread', 'volatility', 'volume', 'actorHistoricalCancellationRate',
        'spoofingIndicator', 'layeringIndicator', 'marketStress'
      ],
      trainingMetrics: {
        accuracy: 0.96,
        precision: 0.93,
        recall: 0.92,
        f1Score: 0.925,
        auc: 0.97,
      },
      isActive: true,
    });

    // XGBoost Model
    this.models.set('xgb_v1', {
      id: 'xgb_v1',
      type: 'XG_BOOST',
      version: '1.0',
      features: [
        'orderSize', 'cancellationRate', 'bidAskImbalance',
        'spoofingIndicator', 'layeringIndicator', 'washTradingIndicator',
        'actorHistoricalViolations', 'marketStress'
      ],
      trainingMetrics: {
        accuracy: 0.95,
        precision: 0.92,
        recall: 0.90,
        f1Score: 0.91,
        auc: 0.96,
      },
      isActive: true,
    });

    // Isolation Forest Model (Anomaly Detection)
    this.models.set('if_v1', {
      id: 'if_v1',
      type: 'ISOLATION_FOREST',
      version: '1.0',
      features: [
        'orderSize', 'orderDuration', 'cancellationRate',
        'bidAskImbalance', 'volume', 'priceDeviation'
      ],
      trainingMetrics: {
        accuracy: 0.92,
        precision: 0.88,
        recall: 0.91,
        f1Score: 0.895,
        auc: 0.94,
      },
      isActive: true,
    });

    this.logger.log(`Initialized ${this.models.size} ML models for anomaly detection`);
  }

  /**
   * Initialize feature scaling parameters
   */
  private initializeFeatureScalers(): void {
    // These would be learned from training data in production
    const scalers = {
      orderSize: { mean: 5000, std: 3000 },
      orderDuration: { mean: 120, std: 60 },
      cancellationRate: { mean: 0.3, std: 0.2 },
      bidAskSpread: { mean: 0.05, std: 0.03 },
      bidAskImbalance: { mean: 0.5, std: 0.2 },
      volatility: { mean: 0.02, std: 0.01 },
      volume: { mean: 100000, std: 50000 },
      timeOfDay: { mean: 12, std: 6 },
      dayOfWeek: { mean: 3, std: 2 },
      actorHistoricalCancellationRate: { mean: 0.2, std: 0.15 },
      actorHistoricalViolations: { mean: 2, std: 5 },
      actorTradeFrequency: { mean: 100, std: 80 },
      spoofingIndicator: { mean: 0.3, std: 0.3 },
      layeringIndicator: { mean: 0.25, std: 0.3 },
      washTradingIndicator: { mean: 0.2, std: 0.25 },
      pumpDumpIndicator: { mean: 0.15, std: 0.2 },
      quoteSuffingIndicator: { mean: 0.1, std: 0.15 },
      marketStress: { mean: 0.3, std: 0.25 },
      liquidityScore: { mean: 0.7, std: 0.15 },
      priceDeviation: { mean: 0.5, std: 0.4 },
    };

    Object.entries(scalers).forEach(([feature, scaler]) => {
      this.featureScalers.set(feature, scaler);
    });

    this.logger.log(`Initialized ${this.featureScalers.size} feature scalers`);
  }

  /**
   * Score anomaly detection using ensemble of models
   */
  async scoreAnomalies(features: DetectionFeatures): Promise<MLScoreResult[]> {
    try {
      // Normalize features
      const normalizedFeatures = this.normalizeFeatures(features);

      // Get active models
      const activeModels = Array.from(this.models.values()).filter(m => m.isActive);

      // Score with each model
      const scores: MLScoreResult[] = [];

      for (const model of activeModels) {
        const score = this.scoreWithModel(model, normalizedFeatures, features);
        scores.push(score);
      }

      // Create ensemble prediction
      const ensembleScore = this.createEnsemblePrediction(scores);
      scores.push(ensembleScore);

      return scores;
    } catch (error) {
      this.logger.error(`Error scoring anomalies: ${error.message}`);
      return [];
    }
  }

  /**
   * Score detection with a specific model
   */
  private scoreWithModel(
    model: MLModel,
    normalizedFeatures: Record<string, number>,
    rawFeatures: DetectionFeatures,
  ): MLScoreResult {
    let anomalyScore = 0;
    const featureWeights: Record<string, number> = {};

    // Model-specific scoring logic
    switch (model.type) {
      case 'RANDOM_FOREST':
        return this.scoreRandomForest(normalizedFeatures, model);
      case 'NEURAL_NETWORK':
        return this.scoreNeuralNetwork(normalizedFeatures, model);
      case 'XG_BOOST':
        return this.scoreXGBoost(normalizedFeatures, model);
      case 'ISOLATION_FOREST':
        return this.scoreIsolationForest(normalizedFeatures, model);
      default:
        throw new Error(`Unknown model type: ${model.type}`);
    }
  }

  /**
   * Random Forest scoring
   */
  private scoreRandomForest(
    normalizedFeatures: Record<string, number>,
    model: MLModel,
  ): MLScoreResult {
    // Simplified RF scoring logic
    const spoofingScore = Math.min(
      normalizedFeatures.spoofingIndicator * 0.5 +
        normalizedFeatures.cancellationRate * 0.3 +
        normalizedFeatures.orderSize * 0.2,
      1.0,
    );

    const layeringScore = Math.min(
      normalizedFeatures.layeringIndicator * 0.6 +
        normalizedFeatures.bidAskImbalance * 0.4,
      1.0,
    );

    const washTradingScore = Math.min(
      normalizedFeatures.washTradingIndicator * 0.7 +
        normalizedFeatures.volume * 0.15 +
        normalizedFeatures.actorHistoricalViolations * 0.15,
      1.0,
    );

    // Determine primary anomaly
    const scores = {
      spoofing: spoofingScore,
      layering: layeringScore,
      washTrading: washTradingScore,
    };

    const [anomalyType, probability] = Object.entries(scores).reduce((prev, curr) =>
      curr[1] > prev[1] ? curr : prev,
    ) as [string, number];

    const severity = this.calculateSeverity(probability);

    return {
      anomalyProbability: probability,
      anomalyType: this.mapAnomalyTypeString(anomalyType),
      severity,
      confidence: Math.round(probability * 100),
      featureImportance: {
        spoofingIndicator: 0.35,
        cancellationRate: 0.25,
        orderSize: 0.2,
        bidAskImbalance: 0.15,
        actorHistoricalViolations: 0.05,
      },
      modelId: model.id,
      modelVersion: model.version,
      explanation: `RFModel detected ${anomalyType} pattern with ${(probability * 100).toFixed(1)}% probability`,
      isEnsemblePrediction: false,
    };
  }

  /**
   * Neural Network scoring
   */
  private scoreNeuralNetwork(
    normalizedFeatures: Record<string, number>,
    model: MLModel,
  ): MLScoreResult {
    // Simulate NN inference (in production, this would call actual NN)
    const hiddenLayer1 = this.relu(
      normalizedFeatures.orderSize * 0.3 -
        normalizedFeatures.cancellationRate * 0.2 +
        normalizedFeatures.bidAskSpread * 0.15,
    );

    const hiddenLayer2 = this.relu(
      normalizedFeatures.spoofingIndicator * 0.4 -
        normalizedFeatures.liquidityScore * 0.3 +
        normalizedFeatures.marketStress * 0.3,
    );

    const outputScore = this.sigmoid(hiddenLayer1 * 0.5 + hiddenLayer2 * 0.5);

    // Determine anomaly type based on indicator scores
    const indicators = {
      spoofing: normalizedFeatures.spoofingIndicator,
      layering: normalizedFeatures.layeringIndicator,
      washTrading: normalizedFeatures.washTradingIndicator,
      pumpDump: normalizedFeatures.pumpDumpIndicator,
      quoteStuffing: normalizedFeatures.quoteSuffingIndicator,
    };

    const [anomalyType, score] = Object.entries(indicators).reduce((prev, curr) =>
      curr[1] > prev[1] ? curr : prev,
    ) as [string, number];

    const probability = Math.max(outputScore, score);
    const severity = this.calculateSeverity(probability);

    return {
      anomalyProbability: probability,
      anomalyType: this.mapAnomalyTypeString(anomalyType),
      severity,
      confidence: Math.round(probability * 100),
      featureImportance: {
        orderSize: 0.25,
        cancellationRate: 0.2,
        bidAskSpread: 0.15,
        spoofingIndicator: 0.2,
        marketStress: 0.15,
        liquidityScore: 0.05,
      },
      modelId: model.id,
      modelVersion: model.version,
      explanation: `NNModel detected ${anomalyType} pattern with ${(probability * 100).toFixed(1)}% probability`,
      isEnsemblePrediction: false,
    };
  }

  /**
   * XGBoost scoring
   */
  private scoreXGBoost(
    normalizedFeatures: Record<string, number>,
    model: MLModel,
  ): MLScoreResult {
    // Simplified XGB scoring with boosted trees logic
    const tree1 = Math.min(
      normalizedFeatures.cancellationRate * 0.4 +
        normalizedFeatures.spoofingIndicator * 0.4 +
        normalizedFeatures.orderSize * 0.2,
      1.0,
    );

    const tree2 = Math.min(
      normalizedFeatures.layeringIndicator * 0.5 +
        normalizedFeatures.bidAskImbalance * 0.3 +
        normalizedFeatures.volatility * 0.2,
      1.0,
    );

    const tree3 = Math.min(
      normalizedFeatures.washTradingIndicator * 0.4 +
        normalizedFeatures.volume * 0.3 +
        normalizedFeatures.actorHistoricalViolations * 0.3,
      1.0,
    );

    // Boosted combination (with learning rates)
    const probability = (tree1 * 0.4 + tree2 * 0.35 + tree3 * 0.25) / 1.0;
    const severity = this.calculateSeverity(probability);

    return {
      anomalyProbability: probability,
      anomalyType: AnomalyType.SPOOFING, // Primary detection
      severity,
      confidence: Math.round(probability * 100),
      featureImportance: {
        cancellationRate: 0.3,
        spoofingIndicator: 0.25,
        layeringIndicator: 0.2,
        washTradingIndicator: 0.15,
        bidAskImbalance: 0.1,
      },
      modelId: model.id,
      modelVersion: model.version,
      explanation: `XGBModel ensemble detected manipulation pattern with ${(probability * 100).toFixed(1)}% probability`,
      isEnsemblePrediction: false,
    };
  }

  /**
   * Isolation Forest scoring (outlier detection)
   */
  private scoreIsolationForest(
    normalizedFeatures: Record<string, number>,
    model: MLModel,
  ): MLScoreResult {
    // IF uses path length to root - shorter = more anomalous
    const anomalyScore = Math.exp(
      -(
        Math.abs(normalizedFeatures.orderSize - 0.5) * 0.2 +
        Math.abs(normalizedFeatures.cancellationRate - 0.3) * 0.3 +
        Math.abs(normalizedFeatures.priceDeviation - 0.5) * 0.2 +
        Math.abs(normalizedFeatures.volume - 0.5) * 0.3
      ),
    );

    return {
      anomalyProbability: anomalyScore,
      anomalyType: AnomalyType.UNUSUAL_VOLUME,
      severity: this.calculateSeverity(anomalyScore),
      confidence: Math.round(anomalyScore * 100),
      featureImportance: {
        orderSize: 0.25,
        cancellationRate: 0.25,
        priceDeviation: 0.25,
        volume: 0.25,
      },
      modelId: model.id,
      modelVersion: model.version,
      explanation: `IFModel detected statistical outlier with ${(anomalyScore * 100).toFixed(1)}% anomaly score`,
      isEnsemblePrediction: false,
    };
  }

  /**
   * Create ensemble prediction from multiple models
   */
  private createEnsemblePrediction(allPredictions: MLScoreResult[]): MLScoreResult {
    const validPredictions = allPredictions.slice(0, -1); // Exclude self

    // Average probabilities
    const avgProbability =
      validPredictions.reduce((sum, p) => sum + p.anomalyProbability, 0) /
      validPredictions.length;

    // Majority vote on anomaly type
    const anomalyVotes = new Map<AnomalyType, number>();
    validPredictions.forEach(p => {
      anomalyVotes.set(p.anomalyType, (anomalyVotes.get(p.anomalyType) || 0) + 1);
    });

    const [anomalyType] = Array.from(anomalyVotes.entries()).reduce((prev, curr) =>
      curr[1] > prev[1] ? curr : prev,
    );

    // Average feature importance
    const featureImportance: Record<string, number> = {};
    const allFeatures = new Set<string>();

    validPredictions.forEach(p => {
      Object.keys(p.featureImportance).forEach(f => allFeatures.add(f));
    });

    allFeatures.forEach(feature => {
      const sum = validPredictions.reduce((s, p) => s + (p.featureImportance[feature] || 0), 0);
      featureImportance[feature] = sum / validPredictions.length;
    });

    const ensembleSeverity = this.calculateSeverity(avgProbability);

    return {
      anomalyProbability: avgProbability,
      anomalyType,
      severity: ensembleSeverity,
      confidence: Math.round(avgProbability * 100),
      featureImportance,
      modelId: 'ensemble',
      modelVersion: '1.0',
      explanation: `Ensemble (${validPredictions.length} models) detected ${anomalyType} with ${(avgProbability * 100).toFixed(1)}% confidence`,
      isEnsemblePrediction: true,
      ensembleModels: validPredictions.map(p => p.modelId),
    };
  }

  /**
   * Normalize features using learned scalers
   */
  private normalizeFeatures(features: DetectionFeatures): Record<string, number> {
    const normalized: Record<string, number> = {};

    Object.entries(features).forEach(([key, value]) => {
      const scaler = this.featureScalers.get(key);
      if (scaler) {
        // Z-score normalization: (x - mean) / std
        normalized[key] = (value - scaler.mean) / scaler.std;
      } else {
        // If no scaler, use min-max normalization to [0, 1]
        normalized[key] = Math.max(0, Math.min(1, value));
      }
    });

    return normalized;
  }

  /**
   * ReLU activation function
   */
  private relu(x: number): number {
    return Math.max(0, x);
  }

  /**
   * Sigmoid activation function
   */
  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  /**
   * Map anomaly type string to enum
   */
  private mapAnomalyTypeString(type: string): AnomalyType {
    const mapping: Record<string, AnomalyType> = {
      spoofing: AnomalyType.SPOOFING,
      layering: AnomalyType.LAYERING,
      washTrading: AnomalyType.WASH_TRADING,
      pumpDump: AnomalyType.PUMP_AND_DUMP,
      quoteStuffing: AnomalyType.QUOTE_STUFFING,
      washtrading: AnomalyType.WASH_TRADING,
    };

    return mapping[type] || AnomalyType.SPOOFING;
  }

  /**
   * Calculate severity from probability score
   */
  private calculateSeverity(probability: number): SeverityLevel {
    if (probability >= 0.85) return SeverityLevel.CRITICAL;
    if (probability >= 0.65) return SeverityLevel.HIGH;
    if (probability >= 0.45) return SeverityLevel.MEDIUM;
    return SeverityLevel.LOW;
  }

  /**
   * Get active models
   */
  async getActiveModels(): Promise<MLModel[]> {
    return Array.from(this.models.values()).filter(m => m.isActive);
  }

  /**
   * Get model by ID
   */
  async getModel(modelId: string): Promise<MLModel | undefined> {
    return this.models.get(modelId);
  }

  /**
   * Register new model (for retraining)
   */
  async registerModel(model: MLModel): Promise<void> {
    this.models.set(model.id, model);
    this.logger.log(`Registered new ML model: ${model.id} v${model.version}`);
  }
}

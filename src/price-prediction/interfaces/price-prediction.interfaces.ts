export type PredictionTimeframe = '1m' | '5m' | '1h' | '1d';

export type PredictionModelType = 'lstm' | 'transformer' | 'ensemble';

export type TradingSignalAction = 'BUY' | 'SELL' | 'HOLD';

export interface CandlePoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SocialSentimentSnapshot {
  score: number;
  volume: number;
  sourceBreakdown: Record<string, number>;
}

export interface OnChainMetricsSnapshot {
  activeAddresses: number;
  transactionCount: number;
  exchangeNetflow: number;
  whaleTransferScore: number;
}

export interface MacroIndicatorsSnapshot {
  usdIndex: number;
  us10yYield: number;
  inflationNowcast: number;
  riskOnScore: number;
}

export interface UnifiedMarketContext {
  symbol: string;
  timeframe: PredictionTimeframe;
  candles: CandlePoint[];
  sentiment: SocialSentimentSnapshot;
  onChain: OnChainMetricsSnapshot;
  macro: MacroIndicatorsSnapshot;
  fetchedAt: string;
  dataSources: string[];
}

export interface EngineeredSample {
  timestamp: number;
  close: number;
  features: number[];
}

export interface ModelTrainingSummary {
  modelType: PredictionModelType;
  version: string;
  trainedAt: string;
  sampleCount: number;
  trainingLoss: number;
  validationMae: number;
  validationDirectionalAccuracy: number;
}

export interface ModelPrediction {
  modelType: PredictionModelType;
  version: string;
  predictedPrice: number;
  expectedReturn: number;
  confidence: number;
}

export interface PredictionRequest {
  symbol: string;
  timeframe: PredictionTimeframe;
  horizonSteps: number;
}

export interface PricePredictionResponse {
  symbol: string;
  timeframe: PredictionTimeframe;
  horizonSteps: number;
  predictedPrice: number;
  expectedReturnPct: number;
  confidence: number;
  signal: TradingSignalAction;
  modelVersion: string;
  modelBreakdown: ModelPrediction[];
  contextAgeMs: number;
  generatedAt: string;
}

export interface BacktestPoint {
  timestamp: number;
  actualPrice: number;
  predictedPrice: number;
  absoluteError: number;
  percentageError: number;
  directionalHit: boolean;
}

export interface BacktestResult {
  symbol: string;
  timeframe: PredictionTimeframe;
  evaluatedPoints: number;
  mae: number;
  rmse: number;
  mape: number;
  directionalAccuracy: number;
  coverage: number;
  confidenceCalibrationError: number;
  points: BacktestPoint[];
  modelVersion: string;
  generatedAt: string;
}

export interface ModelValidationSnapshot {
  modelType: PredictionModelType;
  version: string;
  mae: number;
  rmse: number;
  directionalAccuracy: number;
  confidenceCalibrationError: number;
  updatedAt: string;
}

export interface PredictionModel {
  readonly modelType: PredictionModelType;
  train(samples: EngineeredSample[]): ModelTrainingSummary;
  predict(samples: EngineeredSample[], horizonSteps: number): ModelPrediction;
}

export interface RetrainingJobResult {
  timeframe: PredictionTimeframe;
  symbols: string[];
  summaries: ModelTrainingSummary[];
  finishedAt: string;
}

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum PredictionType {
  PRICE = 'price',
  VOLATILITY = 'volatility',
  CORRELATION = 'correlation',
  TREND = 'trend',
}

export enum PredictionHorizon {
  ONE_DAY = '1d',
  ONE_WEEK = '1w',
  ONE_MONTH = '1m',
  THREE_MONTHS = '3m',
  SIX_MONTHS = '6m',
  ONE_YEAR = '1y',
}

@Entity('market_predictions')
export class MarketPredictionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'asset_symbol' })
  @Index()
  assetSymbol: string;

  @Column({
    type: 'enum',
    enum: PredictionType,
  })
  @Index()
  predictionType: PredictionType;

  @Column({
    type: 'enum',
    enum: PredictionHorizon,
  })
  @Index()
  horizon: PredictionHorizon;

  @Column({ type: 'decimal', precision: 15, scale: 6 })
  predictedValue: number;

  @Column({ type: 'decimal', precision: 10, scale: 4 })
  confidence: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  upperBound: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  lowerBound: number;

  @Column({ type: 'json', nullable: true })
  modelMetadata: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  features: Record<string, number>;

  @Column({ type: 'decimal', precision: 15, scale: 6, nullable: true })
  actualValue: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  accuracy: number;

  @Column({ name: 'prediction_date' })
  @Index()
  predictionDate: Date;

  @Column({ name: 'target_date' })
  @Index()
  targetDate: Date;

  @Column({ name: 'model_version' })
  modelVersion: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'updated_at', nullable: true })
  updatedAt: Date;
}

import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('heatmap_metrics')
@Index(['tradingPair'])
@Index(['timeWindow'])
@Index(['priceLevel'])
@Index(['createdAt'])
@Index(['tradingPair', 'timeWindow'])
@Index(['tradingPair', 'priceLevel'])
export class HeatmapMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  tradingPair: string;

  // Time window (hourly buckets)
  @Column({ type: 'timestamp' })
  timeWindow: Date; // Start of hour bucket

  // Price level bucketing
  @Column({ type: 'decimal', precision: 20, scale: 8 })
  priceLevel: number; // Bucketed price (rounded to nearest 0.1%)

  @Column({ type: 'varchar', length: 50, nullable: true })
  priceBucket: string; // e.g., "100.00-100.10"

  // Activity metrics
  @Column({ type: 'integer', default: 0 })
  anomalyCounts: number; // Total anomalies detected in this bucket

  @Column({ type: 'integer', default: 0 })
  spoofingCount: number;

  @Column({ type: 'integer', default: 0 })
  layeringCount: number;

  @Column({ type: 'integer', default: 0 })
  washTradingCount: number;

  @Column({ type: 'integer', default: 0 })
  otherAnomalyCount: number;

  // Volume and order metrics
  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  orderVolume: number; // Total volume at this price level

  @Column({ type: 'integer', default: 0 })
  orderCount: number;

  @Column({ type: 'integer', default: 0 })
  canceledOrderCount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  cancellationRate: number; // %

  // Actor metrics
  @Column({ type: 'integer', default: 0 })
  uniqueActors: number;

  @Column({ type: 'integer', default: 0 })
  suspiciousActorCount: number;

  @Column({ type: 'simple-array', nullable: true })
  actorIds: string[];

  // Risk assessment
  @Column({ type: 'decimal', precision: 5, scale: 2 })
  riskScore: number; // 0-100

  @Column({ type: 'varchar', length: 50 })
  riskLevel: string; // LOW, MEDIUM, HIGH, CRITICAL

  // Market metrics
  @Column({ type: 'decimal', precision: 5, scale: 2 })
  volatility: number; // %

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  bidAskSpread: number; // %

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  priceImpact: number; // %

  // Alert summary
  @Column({ type: 'integer', default: 0 })
  resolvedAlerts: number;

  @Column({ type: 'integer', default: 0 })
  unresolveddAlerts: number;

  @Column({ type: 'integer', default: 0 })
  falsePositives: number;

  @Column({ type: 'integer', default: 0 })
  escalatedAlerts: number;

  // Historical comparison
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  anomalyRatioVsAverage: number; // Ratio of this bucket's anomalies vs historical avg

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  volumeRatioVsAverage: number; // Ratio of volume vs historical avg

  // Visualization flags
  @Column({ type: 'boolean', default: false })
  isHotspot: boolean; // True if risk score > threshold

  @Column({ type: 'boolean', default: false })
  isOutlier: boolean; // True if significantly different from avg

  @Column({ type: 'varchar', length: 50, nullable: true })
  visualizationColor: string; // hex color: #FF0000 (red) to #00FF00 (green)

  @Column({ type: 'varchar', length: 50, nullable: true })
  visualizationIntensity: string; // LOW, MEDIUM, HIGH, CRITICAL

  // Detailed metrics breakdown
  @Column({ type: 'jsonb', nullable: true })
  detailedMetrics: {
    averageOrderSize?: number;
    maxOrderSize?: number;
    minOrderSize?: number;
    averageOrderDuration?: number;
    topAnomalyTypes?: Record<string, number>;
    topActors?: Array<{ actorId: string; count: number }>;
    priceMovement?: {
      open?: number;
      close?: number;
      high?: number;
      low?: number;
    };
  };

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  archivedAt: Date; // For data retention policy

  @Column({ type: 'boolean', default: false })
  isArchived: boolean;
}

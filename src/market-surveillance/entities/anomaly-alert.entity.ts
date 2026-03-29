import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

export enum AnomalyType {
  SPOOFING = 'SPOOFING',
  LAYERING = 'LAYERING',
  PUMP_AND_DUMP = 'PUMP_AND_DUMP',
  WASH_TRADING = 'WASH_TRADING',
  UNUSUAL_VOLUME = 'UNUSUAL_VOLUME',
  PRICE_MANIPULATION = 'PRICE_MANIPULATION',
  ORDER_FLOODING = 'ORDER_FLOODING',
  QUOTE_STUFFING = 'QUOTE_STUFFING',
  LAYERING_ATTACK = 'LAYERING_ATTACK',
  SPOOFING_BID_ASK = 'SPOOFING_BID_ASK',
  UNUSUAL_CANCELLATION = 'UNUSUAL_CANCELLATION',
  MICRO_STRUCTURES = 'MICRO_STRUCTURES',
}

export enum SeverityLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum AlertStatus {
  DETECTED = 'DETECTED',
  INVESTIGATING = 'INVESTIGATING',
  CONFIRMED = 'CONFIRMED',
  FALSE_POSITIVE = 'FALSE_POSITIVE',
  RESOLVED = 'RESOLVED',
  ESCALATED = 'ESCALATED',
}

@Entity('anomaly_alerts')
@Index(['tradingPair', 'timestamp'])
@Index(['anomalyType', 'severity'])
@Index(['actorId'])
@Index(['status', 'timestamp'])
export class AnomalyAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  tradingPair: string; // e.g., ETH/USD

  @Column({ type: 'varchar', length: 50 })
  anomalyType: AnomalyType;

  @Column({ type: 'varchar', length: 20 })
  severity: SeverityLevel;

  @Column({ type: 'varchar', length: 50 })
  status: AlertStatus;

  @Column({ type: 'uuid' })
  actorId: string; // Trader/Market maker ID

  @Column({ type: 'varchar', length: 255, nullable: true })
  walletAddress: string;

  // Detection details
  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  confidenceScore: number; // 0-100

  @Column({ type: 'jsonb', nullable: true })
  detectionMetrics: {
    ordersCount?: number;
    canceledCount?: number;
    totalVolume?: number;
    priceDeviation?: number;
    timeInterval?: number; // milliseconds
    pattern?: string;
  };

  // Pattern evidence
  @Column({ type: 'jsonb', nullable: true })
  evidenceData: {
    orders: Array<{
      orderId: string;
      price: number;
      quantity: number;
      side: string;
      timestamp: Date;
      canceled?: boolean;
    }>;
    timeline?: string;
  };

  // Explainability
  @Column({ type: 'jsonb' })
  explanationLog: {
    timestamp: Date;
    rule: string;
    reasoning: string;
    metrics: Record<string, any>;
    modelVersion?: string;
    featureImportance?: Record<string, number>;
  }[];

  // Action taken
  @Column({ type: 'varchar', length: 50, nullable: true })
  actionTaken: string; // THROTTLE, SUSPEND, WARN, NONE

  @Column({ type: 'boolean', default: false })
  isThrottled: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  throttlePercent?: number; // Rate limit reduction %

  // Investigation details
  @Column({ type: 'uuid', nullable: true })
  investigatedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  investigatedAt: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  investigationNotes: string;

  @Column({ type: 'varchar', length: 250, nullable: true })
  resolutionNotes: string;

  // Linked events
  @Column({ type: 'uuid', nullable: true })
  relatedAlertId: string;

  @Column({ type: 'simple-array', nullable: true })
  linkedOrderIds: string[];

  @Column({ type: 'simple-array', nullable: true })
  linkedTransactionIds: string[];

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  timestamp: Date;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  riskScore: string; // Composite risk rating
}

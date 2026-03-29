import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum ViolationType {
  SPOOFING = 'SPOOFING',
  LAYERING = 'LAYERING',
  WASH_TRADING = 'WASH_TRADING',
  PUMP_AND_DUMP = 'PUMP_AND_DUMP',
  QUOTE_STUFFING = 'QUOTE_STUFFING',
  ORDER_FLOODING = 'ORDER_FLOODING',
  PRICE_MANIPULATION = 'PRICE_MANIPULATION',
  UNUSUAL_CANCELLATION = 'UNUSUAL_CANCELLATION',
  MICRO_STRUCTURES = 'MICRO_STRUCTURES',
  UNUSUAL_VOLUME = 'UNUSUAL_VOLUME',
  LAYERING_ATTACK = 'LAYERING_ATTACK',
  SPOOFING_BID_ASK = 'SPOOFING_BID_ASK',
}

export enum ViolationStatus {
  UNCONFIRMED = 'UNCONFIRMED',
  CONFIRMED = 'CONFIRMED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  DISMISSED = 'DISMISSED',
  ESCALATED = 'ESCALATED',
  RESOLVED = 'RESOLVED',
}

export enum RegulatoryAction {
  NO_ACTION = 'NO_ACTION',
  WARNING = 'WARNING',
  SUSPENSION = 'SUSPENSION',
  BAN = 'BAN',
  FINE = 'FINE',
  REFERRED_TO_AUTHORITIES = 'REFERRED_TO_AUTHORITIES',
}

@Entity('violation_events')
@Index(['anomalyAlertId'])
@Index(['actorId'])
@Index(['violationType'])
@Index(['status'])
@Index(['createdAt'])
@Index(['violationType', 'status'])
export class ViolationEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Link to original anomaly detection
  @Column({ type: 'uuid' })
  anomalyAlertId: string;

  @Column({ type: 'uuid' })
  actorId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  walletAddress: string;

  // Violation classification
  @Column({ type: 'varchar', length: 50 })
  violationType: ViolationType;

  @Column({ type: 'varchar', length: 50, default: 'UNCONFIRMED' })
  status: ViolationStatus;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  confidenceScore: number; // 0-100

  // Trading pair and time window
  @Column({ type: 'varchar', length: 50 })
  tradingPair: string;

  @Column({ type: 'timestamp' })
  violationTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  violationEndTime: Date;

  @Column({ type: 'integer' })
  durationSeconds: number; // How long the violation lasted

  // Violation details
  @Column({ type: 'decimal', precision: 20, scale: 8 })
  estimatedImpactAmount: number; // $ value of impact

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  estimatedImpactPercent: number; // % of market impact

  @Column({ type: 'integer', default: 0 })
  affectedOrderCount: number;

  @Column({ type: 'integer', default: 0 })
  affectedTradeCount: number;

  @Column({ type: 'simple-array', nullable: true })
  relatedOrderIds: string[];

  @Column({ type: 'simple-array', nullable: true })
  relatedTransactionIds: string[];

  // Evidence
  @Column({ type: 'jsonb' })
  evidence: {
    pattern?: string;
    metrics?: Record<string, number>;
    orderDetails?: Record<string, any>[];
    priceMovement?: Record<string, any>;
    cancelationPattern?: Record<string, any>;
  };

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string;

  // Regulatory action
  @Column({ type: 'varchar', length: 50, default: 'NO_ACTION' })
  regulatoryAction: RegulatoryAction;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  finesAmount: number;

  @Column({ type: 'boolean', default: false })
  reportedToRegulator: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  regulatorName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  caseNumber: string;

  // Investigation tracking
  @Column({ type: 'uuid', nullable: true })
  investigatorId: string;

  @Column({ type: 'timestamp', nullable: true })
  investigationStartedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  investigationCompletedAt: Date;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  investigationFindings: string;

  // Resolution
  @Column({ type: 'varchar', length: 500, nullable: true })
  resolutionDetails: string;

  @Column({ type: 'boolean', default: false })
  actorAcknowledged: boolean;

  @Column({ type: 'timestamp', nullable: true })
  acknowledgedAt: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  actorResponse: string;

  @Column({ type: 'boolean', default: false })
  appealed: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  appealReason: string;

  @Column({ type: 'timestamp', nullable: true })
  appealedAt: Date;

  @Column({ type: 'boolean', default: false })
  appealDismissed: boolean;

  // Audit trail
  @Column({ type: 'jsonb', nullable: true })
  auditLog: Array<{
    timestamp: Date;
    action: string;
    performedBy: string;
    details: Record<string, any>;
  }>;

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date;
}

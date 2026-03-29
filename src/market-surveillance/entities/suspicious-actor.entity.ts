import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum ThrottleLevel {
  NONE = 'NONE',
  WARNING = 'WARNING',
  LIGHT = 'LIGHT', // 25% rate limit
  MODERATE = 'MODERATE', // 50% rate limit
  SEVERE = 'SEVERE', // 75% rate limit
  SUSPENDED = 'SUSPENDED', // 100% rate limit (no trading)
}

@Entity('suspicious_actors')
@Index(['actorId'])
@Index(['throttleLevel'])
@Index(['lastAlertTime'])
export class SuspiciousActor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  actorId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  walletAddress: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  name: string; // Trader/Market maker name

  @Column({ type: 'varchar', length: 50, default: 'NONE' })
  throttleLevel: ThrottleLevel;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  throttlePercent: number; // 0-100

  // Violation history
  @Column({ type: 'integer', default: 0 })
  totalViolations: number;

  @Column({ type: 'integer', default: 0 })
  spoofingCount: number;

  @Column({ type: 'integer', default: 0 })
  layeringCount: number;

  @Column({ type: 'integer', default: 0 })
  washTradingCount: number;

  @Column({ type: 'integer', default: 0 })
  otherViolationCount: number;

  // Risk scoring
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  riskScore: number; // 0-100

  @Column({ type: 'varchar', length: 50, nullable: true })
  riskLevel: string; // LOW, MEDIUM, HIGH, CRITICAL

  // Trading patterns
  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  totalVolumeTraded: number;

  @Column({ type: 'integer', default: 0 })
  totalOrdersPlaced: number;

  @Column({ type: 'integer', default: 0 })
  totalOrdersCanceled: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  cancellationRate: number; // Percentage

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  averageOrderDuration: number; // seconds

  // Activity tracking
  @Column({ type: 'timestamp', nullable: true })
  lastAlertTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastViolationTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  throttledUntil: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  throttleReason: string;

  // Trading pairs involved
  @Column({ type: 'simple-array', nullable: true })
  tradingPairsInvolved: string[];

  // Linked accounts (potential coordinated activity)
  @Column({ type: 'simple-array', nullable: true })
  linkedActors: string[];

  // Status
  @Column({ type: 'boolean', default: false })
  isUnderInvestigation: boolean;

  @Column({ type: 'boolean', default: false })
  isWhitelisted: boolean;

  @Column({ type: 'uuid', nullable: true })
  investigatorId: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  investigationNotes: string;

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  behaviorProfile: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  firstSeenAt: Date;

  @UpdateDateColumn()
  lastSeenAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  clearedAt: Date;
}

import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { SettlementBatch } from './settlement-batch.entity';

export enum DiscrepancyType {
  MISSING_SETTLEMENT = 'MISSING_SETTLEMENT',
  EXTRA_SETTLEMENT = 'EXTRA_SETTLEMENT',
  AMOUNT_MISMATCH = 'AMOUNT_MISMATCH',
  CURRENCY_MISMATCH = 'CURRENCY_MISMATCH',
  STATUS_MISMATCH = 'STATUS_MISMATCH',
  TIMING_MISMATCH = 'TIMING_MISMATCH',
  FX_RATE_VARIANCE = 'FX_RATE_VARIANCE',
  FAILED_SETTLEMENT = 'FAILED_SETTLEMENT',
  DUPLICATE_SETTLEMENT = 'DUPLICATE_SETTLEMENT',
  ORPHANED_SETTLEMENT = 'ORPHANED_SETTLEMENT',
}

export enum ResolutionStatus {
  OPEN = 'OPEN',
  UNDER_INVESTIGATION = 'UNDER_INVESTIGATION',
  RESOLVED_APPROVED = 'RESOLVED_APPROVED',
  RESOLVED_REJECTED = 'RESOLVED_REJECTED',
  RESOLVED_MANUAL = 'RESOLVED_MANUAL',
  ESCALATED = 'ESCALATED',
}

@Entity('settlement_reconciliations')
@Index(['batchId', 'createdAt'])
@Index(['resolutionStatus'])
@Index(['discrepancyType'])
export class SettlementReconciliation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  batchId: string;

  @ManyToOne(() => SettlementBatch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'batchId' })
  batch: SettlementBatch;

  @Column({ type: 'varchar', length: 50 })
  discrepancyType: DiscrepancyType;

  @Column({ type: 'uuid', nullable: true })
  settlementId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  settlementReference: string;

  // Discrepancy details
  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  expectedAmount: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  actualAmount: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  varianceAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  variancePercent: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  expectedCurrency: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  actualCurrency: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  expectedStatus: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  actualStatus: string;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  expectedFxRate: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  actualFxRate: number;

  @Column({ type: 'text' })
  description: string;

  // Resolution tracking
  @Column({ type: 'varchar', length: 50 })
  resolutionStatus: ResolutionStatus;

  @Column({ type: 'text', nullable: true })
  resolutionNotes: string;

  @Column({ type: 'uuid', nullable: true })
  investigatedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  investigatedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  resolvedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  approvalReference: string;

  // Impact assessment
  @Column({ type: 'boolean', default: false })
  isSystematic: boolean; // Indicates pattern in errors

  @Column({ type: 'boolean', default: false })
  requiresManualReview: boolean;

  @Column({ type: 'boolean', default: false })
  impactsReconciliation: boolean;

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  auditTrail: Array<{
    timestamp: Date;
    action: string;
    actor: string;
    details: string;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

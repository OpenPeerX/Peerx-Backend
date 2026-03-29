import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

export enum AuditAction {
  SETTLEMENT_CREATED = 'SETTLEMENT_CREATED',
  SETTLEMENT_INITIATED = 'SETTLEMENT_INITIATED',
  SETTLEMENT_PROCESSING = 'SETTLEMENT_PROCESSING',
  SETTLEMENT_CONVERTED = 'SETTLEMENT_CONVERTED',
  SETTLEMENT_ROUTED = 'SETTLEMENT_ROUTED',
  SETTLEMENT_COMPLETED = 'SETTLEMENT_COMPLETED',
  SETTLEMENT_FAILED = 'SETTLEMENT_FAILED',
  SETTLEMENT_CANCELLED = 'SETTLEMENT_CANCELLED',
  SETTLEMENT_RETRIED = 'SETTLEMENT_RETRIED',
  COMPLIANCE_APPROVED = 'COMPLIANCE_APPROVED',
  COMPLIANCE_REJECTED = 'COMPLIANCE_REJECTED',
  COMPLIANCE_FLAGGED = 'COMPLIANCE_FLAGGED',
  BATCH_CREATED = 'BATCH_CREATED',
  BATCH_SUBMITTED = 'BATCH_SUBMITTED',
  BATCH_PROCESSED = 'BATCH_PROCESSED',
  BATCH_COMPLETED = 'BATCH_COMPLETED',
  BATCH_APPROVED = 'BATCH_APPROVED',
  BATCH_REJECTED = 'BATCH_REJECTED',
  RECONCILIATION_INITIATED = 'RECONCILIATION_INITIATED',
  RECONCILIATION_COMPLETED = 'RECONCILIATION_COMPLETED',
  DISCREPANCY_DETECTED = 'DISCREPANCY_DETECTED',
  DISCREPANCY_RESOLVED = 'DISCREPANCY_RESOLVED',
  FX_RATE_UPDATED = 'FX_RATE_UPDATED',
  CONFIG_UPDATED = 'CONFIG_UPDATED',
  MANUAL_INTERVENTION = 'MANUAL_INTERVENTION',
  EXCEPTION_HANDLED = 'EXCEPTION_HANDLED',
}

@Entity('settlement_audit_logs')
@Index(['entityId', 'entityType', 'createdAt'])
@Index(['action', 'createdAt'])
@Index(['actorId', 'createdAt'])
@Index(['timestamp'])
export class SettlementAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  entityId: string; // Settlement ID, Batch ID, etc.

  @Column({ type: 'varchar', length: 50 })
  entityType: string; // SETTLEMENT, BATCH, RECONCILIATION, CONFIG

  @Column({ type: 'varchar', length: 50 })
  action: AuditAction;

  @Column({ type: 'uuid', nullable: true })
  actorId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  actorName: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  actorRole: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  actorType: string; // USER, SYSTEM, API, SCHEDULED_JOB

  // Change tracking
  @Column({ type: 'jsonb', nullable: true })
  previousState: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  newState: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  changes: Record<string, {
    old: any;
    new: any;
    fieldName: string;
  }>;

  // Context information
  @Column({ type: 'varchar', length: 100, nullable: true })
  ipAddress: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reason: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string;

  // Status and result
  @Column({ type: 'varchar', length: 50, default: 'SUCCESS' })
  status: string; // SUCCESS, FAILURE, PARTIAL

  @Column({ type: 'varchar', length: 500, nullable: true })
  errorMessage: string;

  // Impact tracking
  @Column({ type: 'integer', nullable: true })
  affectedRecordsCount: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  amountImpacted: number;

  @Column({ type: 'boolean', default: false })
  requiresFollowUp: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  followUpNotes: string;

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  timestamp: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  severity: string; // INFO, WARNING, ERROR, CRITICAL
}

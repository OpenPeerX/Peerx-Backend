import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Settlement } from './settlement.entity';

export enum BatchStatus {
  CREATED = 'CREATED',
  PENDING = 'PENDING',
  SUBMITTED = 'SUBMITTED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  PARTIAL_FAILURE = 'PARTIAL_FAILURE',
  RECONCILED = 'RECONCILED',
}

export enum ReconciliationStatus {
  PENDING_RECONCILIATION = 'PENDING_RECONCILIATION',
  IN_PROGRESS = 'IN_PROGRESS',
  MATCHED = 'MATCHED',
  DISCREPANCIES_FOUND = 'DISCREPANCIES_FOUND',
  RESOLVED = 'RESOLVED',
  EXCEPTION = 'EXCEPTION',
}

@Entity('settlement_batches')
@Index(['status', 'createdAt'])
@Index(['batchNumber'])
@Index(['currency'])
export class SettlementBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  batchNumber: string; // e.g., SETTLE-2026-001

  @Column({ type: 'varchar', length: 50 })
  status: BatchStatus;

  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  totalAmount: number;

  @Column({ type: 'integer' })
  settlementCount: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  totalProcessedAmount: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  totalFailedAmount: number;

  @Column({ type: 'integer', default: 0 })
  successCount: number;

  @Column({ type: 'integer', default: 0 })
  failedCount: number;

  // FX aggregation
  @Column({ type: 'varchar', length: 10, nullable: true })
  sourceCurrency: string;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  averageFxRate: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  totalConvertedAmount: number;

  // Settlement details
  @Column({ type: 'varchar', length: 50 })
  reconciliationStatus: ReconciliationStatus;

  @Column({ type: 'timestamp', nullable: true })
  submittedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  settledAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  reconciledAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  settlementReference: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bankBatchId: string;

  // Back-office tracking
  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @Column({ type: 'uuid', nullable: true })
  approvedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  approvalNotes: string;

  // One-to-Many relationship
  @OneToMany(() => Settlement, (settlement) => settlement.batch)
  settlements: Settlement[];

  // Reconciliation data
  @Column({ type: 'jsonb', nullable: true })
  reconciliationData: {
    expectedCount: number;
    receivedCount: number;
    discrepancies: Array<{
      settlementId: string;
      type: string;
      details: string;
    }>;
    resolutionNotes: string;
  };

  // Metadata and tracking
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'integer', default: 0 })
  retryCount: number;

  @Column({ type: 'timestamp', nullable: true })
  nextRetryAt: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  errorMessage: string;
}

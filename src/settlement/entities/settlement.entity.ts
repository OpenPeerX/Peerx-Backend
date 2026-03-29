import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { SettlementBatch } from './settlement-batch.entity';

export enum SettlementStatus {
  PENDING = 'PENDING',
  INITIATED = 'INITIATED',
  PROCESSING = 'PROCESSING',
  CONVERTING = 'CONVERTING',
  ROUTING = 'ROUTING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  RECONCILED = 'RECONCILED',
}

export enum ComplianceStatus {
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  FLAGGED = 'FLAGGED',
  EXCEPTION = 'EXCEPTION',
}

@Entity('settlements')
@Index(['batchId', 'status'])
@Index(['currency', 'createdAt'])
@Index(['transactionHash'])
@Index(['status'])
export class Settlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  transactionHash: string;

  @Column({ type: 'uuid' })
  fromAddress: string;

  @Column({ type: 'uuid' })
  toAddress: string;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  amount: number;

  @Column({ type: 'varchar', length: 10 })
  currency: string; // USD, USDC, USDT, EUR, GBP, JPY, etc.

  @Column({ type: 'varchar', length: 50 })
  status: SettlementStatus;

  @Column({ type: 'uuid', nullable: true })
  batchId: string;

  @ManyToOne(() => SettlementBatch, (batch) => batch.settlements, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'batchId' })
  batch: SettlementBatch;

  // FX Conversion details
  @Column({ type: 'varchar', length: 10, nullable: true })
  sourceCurrency: string;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  fxRate: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  convertedAmount: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  fxSource: string; // e.g., CoinGecko, Bloomberg, Internal

  @Column({ type: 'varchar', length: 50, nullable: true })
  routingPath: string; // e.g., DIRECT, BRIDGE, STABLECOIN_SWAP

  // Compliance and audit
  @Column({ type: 'varchar', length: 50 })
  complianceStatus: ComplianceStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  complianceNotes: string;

  @Column({ type: 'jsonb', nullable: true })
  auditTrail: {
    timestamp: Date;
    action: string;
    actor: string;
    changes: Record<string, any>;
  }[];

  // Settlement execution details
  @Column({ type: 'varchar', length: 255, nullable: true })
  settlementReference: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  executedAmount: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  failureReason: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  settlementMethod: string; // ACH, Wire, Blockchain, Stablecoin, Bridge

  @Column({ type: 'varchar', length: 100, nullable: true })
  bankAccount: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  wireReference: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  reconciledAt: Date;

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'integer', default: 0 })
  retryCount: number;

  @Column({ type: 'timestamp', nullable: true })
  nextRetryAt: Date;
}

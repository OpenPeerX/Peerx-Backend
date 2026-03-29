import { Entity, PrimaryGeneratedColumn, Column, Index, UpdateDateColumn, CreateDateColumn } from 'typeorm';

export enum ComplianceLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum SettlementRailType {
  ACH = 'ACH',
  WIRE = 'WIRE',
  SEPA = 'SEPA',
  SWIFT = 'SWIFT',
  BLOCKCHAIN = 'BLOCKCHAIN',
  STABLECOIN = 'STABLECOIN',
  BRIDGE = 'BRIDGE',
  INTERNAL = 'INTERNAL',
}

@Entity('currency_configs')
@Index(['currency'])
@Index(['isEnabled'])
export class CurrencyConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 10, unique: true })
  currency: string;

  @Column({ type: 'varchar', length: 100 })
  name: string; // e.g., "US Dollar"

  @Column({ type: 'varchar', length: 50 })
  currencyType: string; // FIAT, STABLECOIN, CRYPTO

  @Column({ type: 'boolean', default: true })
  isEnabled: boolean;

  // Amount controls
  @Column({ type: 'decimal', precision: 20, scale: 8 })
  minSettlementAmount: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  maxSettlementAmount: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  dailyLimitAmount: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  monthlyLimitAmount: number;

  // FX configuration
  @Column({ type: 'varchar', length: 10, nullable: true })
  nativeCurrency: string; // Base currency for this config (e.g., USD for USDC)

  @Column({ type: 'boolean', default: true })
  requiresFxConversion: boolean;

  @Column({ type: 'varchar', length: 100, default: 'DIRECT' })
  fxRoutingPath: string; // DIRECT, BRIDGE, STABLECOIN_SWAP, etc.

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 1.0 })
  maxFxSpread: number; // Maximum acceptable spread %

  // Settlement rail configuration
  @Column({ type: 'simple-array', nullable: true })
  supportedRails: SettlementRailType[];

  @Column({ type: 'varchar', length: 50, default: 'BLOCKCHAIN' })
  preferredRail: SettlementRailType;

  @Column({ type: 'varchar', length: 50 })
  complianceLevel: ComplianceLevel;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  feePercent: number; // Settlement fee %

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  flatFee: number;

  // Compliance configuration
  @Column({ type: 'boolean', default: true })
  requiresAmlCheck: boolean;

  @Column({ type: 'boolean', default: true })
  requiresKycVerification: boolean;

  @Column({ type: 'boolean', default: false })
  requiresManualApproval: boolean;

  @Column({ type: 'integer', default: 24 })
  settlementTimeframeHours: number;

  @Column({ type: 'integer', default: 48 })
  maxProcessingTimeHours: number;

  // Bank/Provider mapping
  @Column({ type: 'varchar', length: 100, nullable: true })
  bankRouting: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bankAccount: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bankName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  blockchainNetwork: string; // For crypto settlements

  @Column({ type: 'varchar', length: 255, nullable: true })
  contractAddress: string;

  // Query configuration
  @Column({ type: 'boolean', default: true })
  isBatchEnabled: boolean;

  @Column({ type: 'integer', default: 100 })
  maxBatchSize: number;

  @Column({ type: 'varchar', length: 50, default: 'HOURLY' })
  batchFrequency: string; // IMMEDIATE, HOURLY, DAILY, WEEKLY

  // Monitoring and alerting
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 5.0 })
  anomalyThresholdPercent: number;

  @Column({ type: 'boolean', default: true })
  enableAnomalyDetection: boolean;

  @Column({ type: 'boolean', default: true })
  enableRealtimeMonitoring: boolean;

  // Reconciliation settings
  @Column({ type: 'varchar', length: 50, default: 'AUTOMATIC' })
  reconciliationType: string; // AUTOMATIC, MANUAL, HYBRID

  @Column({ type: 'integer', default: 24 })
  reconciliationDelayHours: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0.01 })
  tolerancePercent: number; // Acceptable variance for reconciliation

  // Fallback configuration
  @Column({ type: 'varchar', length: 50, nullable: true })
  fallbackCurrency: string;

  @Column({ type: 'boolean', default: true })
  allowFallback: boolean;

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  lastAuditedAt: Date;
}

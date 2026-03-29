import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum PatternType {
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

export enum PatternStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  TESTING = 'TESTING',
  DEPRECATED = 'DEPRECATED',
}

@Entity('pattern_templates')
@Index(['patternType'])
@Index(['status'])
@Index(['isActive'])
export class PatternTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  patternType: PatternType;

  @Column({ type: 'varchar', length: 50, default: 'ACTIVE' })
  status: PatternStatus;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'integer', default: 1 })
  version: number;

  // Pattern description and documentation
  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  ruleExplanation: string;

  @Column({ type: 'text', nullable: true })
  regulatoryReference: string;

  // Detection rules configuration
  @Column({ type: 'jsonb' })
  rules: {
    // Time window for detection (seconds)
    timeWindowSeconds: number;

    // Order/trade count thresholds
    minOrderCount?: number;
    maxOrderCount?: number;
    minCancellationRate?: number; // % (0-100)
    maxCancellationRate?: number; // % (0-100)

    // Volume thresholds
    minVolumeThreshold?: number; // $ amount
    maxVolumeThreshold?: number;
    volumeSpikeMultiplier?: number; // e.g., 10 for 10x spike

    // Price movement thresholds
    minPriceMovement?: number; // %
    maxPriceMovement?: number; // %
    priceCorrectionThreshold?: number; // % (e.g., 5% correction after pump)

    // Order characteristics
    minOrderSize?: number;
    maxOrderSize?: number;
    minOrderDuration?: number; // seconds before cancellation
    maxOrderDuration?: number;

    // Bid-ask dynamics
    bidAskImbalance?: number; // Ratio threshold
    spreadDeviation?: number; // Standard deviations

    // Frequency/rate limits
    maxOrdersPerSecond?: number;
    maxCancelsPerSecond?: number;
    minActorCoolingPeriod?: number; // seconds between actions

    // Pattern-specific rules (flexible JSON)
    customRules?: Record<string, any>;
  };

  // Scoring configuration
  @Column({ type: 'jsonb' })
  scoringConfig: {
    baseScore: number; // Base confidence (0-100)
    ruleWeights: Record<string, number>; // Weight for each rule
    multipliers: {
      volumeMultiplier?: number;
      frequencyMultiplier?: number;
      historicalMultiplier?: number;
      coordinationMultiplier?: number;
    };
    minConfidenceThreshold: number; // 0-100, alert only if above
    escalationThresholds: {
      warning?: number; // 40%
      moderate?: number; // 60%
      high?: number; // 80%
      critical?: number; // 95%
    };
  };

  // Feature importance for explainability
  @Column({ type: 'jsonb', nullable: true })
  featureImportance: {
    [featureName: string]: number; // Feature importance score (0-1)
  };

  // Trading pairs this pattern applies to
  @Column({ type: 'simple-array', nullable: true })
  applicableTradingPairs: string[]; // [] = all pairs

  @Column({ type: 'boolean', default: true })
  appliedToAllPairs: boolean;

  // Actor types this pattern targets
  @Column({ type: 'simple-array', nullable: true })
  targetActorTypes: string[]; // e.g., ['HIGH_FREQUENCY', 'MARKET_MAKER', 'RETAIL']

  // Time-based activation
  @Column({ type: 'boolean', default: true })
  isAlwaysActive: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  activeTimeStart: string; // HH:mm format, e.g., "09:30"

  @Column({ type: 'varchar', length: 50, nullable: true })
  activeTimeEnd: string; // HH:mm format, e.g., "16:00"

  @Column({ type: 'simple-array', nullable: true })
  activeDays: string[]; // MON, TUE, WED, THU, FRI, SAT, SUN

  // Performance metrics
  @Column({ type: 'decimal', precision: 5, scale: 4 })
  truePositiveRate: number; // Precision

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  falsePositiveRate: number;

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  detectionRate: number; // Recall

  @Column({ type: 'integer', default: 0 })
  totalDetections: number;

  @Column({ type: 'integer', default: 0 })
  confirmedViolations: number;

  @Column({ type: 'timestamp', nullable: true })
  lastPerformanceUpdate: Date;

  // Testing and rollout
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  rolloutPercentage: number; // 0-100%, for gradual rollout

  @Column({ type: 'timestamp', nullable: true })
  rolloutStartedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  fullRolloutCompletedAt: Date;

  // Version history
  @Column({ type: 'uuid', nullable: true })
  previousVersionId: string;

  @Column({ type: 'jsonb', nullable: true })
  changeLog: Array<{
    version: number;
    timestamp: Date;
    changedBy: string;
    changes: string;
  }>;

  // ML model integration
  @Column({ type: 'varchar', length: 255, nullable: true })
  mlModelId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  mlModelType: string; // e.g., 'RANDOM_FOREST', 'NEURAL_NETWORK'

  @Column({ type: 'boolean', default: false })
  usesMLModel: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  mlModelAccuracy: number;

  // Documentation and references
  @Column({ type: 'text', nullable: true })
  additionalNotes: string;

  @Column({ type: 'simple-array', nullable: true })
  relatedDocuments: string[]; // URLs or file references

  @Column({ type: 'simple-array', nullable: true })
  authorizedEditors: string[]; // User IDs who can modify this pattern

  // Audit trail
  @Column({ type: 'jsonb', nullable: true })
  auditLog: Array<{
    timestamp: Date;
    action: string;
    performedBy: string;
    details: Record<string, any>;
  }>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @Column({ type: 'uuid', nullable: true })
  lastModifiedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  deprecatedAt: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  deprecationReason: string;
}

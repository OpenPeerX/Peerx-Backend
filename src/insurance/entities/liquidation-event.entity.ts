import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum LiquidationStatus {
  INITIATED = 'INITIATED',
  IN_PROGRESS = 'IN_PROGRESS',
  PARTIALLY_COVERED = 'PARTIALLY_COVERED',
  FULLY_COVERED = 'FULLY_COVERED',
  UNCOVERED = 'UNCOVERED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity('liquidation_event')
@Index(['userId'])
@Index(['status'])
@Index(['createdAt'])
@Index(['coveredByInsurance'])
export class LiquidationEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  tradeId: number;

  @Column('varchar', { length: 100 })
  asset: string;

  @Column({
    type: 'enum',
    enum: LiquidationStatus,
    default: LiquidationStatus.INITIATED,
  })
  status: LiquidationStatus;

  @Column('decimal', { precision: 18, scale: 8 })
  positionSize: number;

  @Column('decimal', { precision: 18, scale: 8 })
  liquidationPrice: number;

  @Column('decimal', { precision: 18, scale: 8 })
  totalLoss: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  unrecoveredLoss: number;

  @Column('decimal', { precision: 5, scale: 2 })
  volatilityIndex: number;

  @Column('boolean', { default: false })
  coveredByInsurance: boolean;

  @Column('decimal', {
    precision: 18,
    scale: 8,
    default: 0,
    comment: 'Amount covered by insurance fund',
  })
  insuranceCoverage: number;

  @Column({ nullable: true })
  insuranceClaimId: number;

  @Column('decimal', {
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'Insurance coverage percentage',
  })
  coverageRatio: number;

  @Column('text', { nullable: true })
  triggerReason: string;

  @Column('json', { nullable: true })
  orderDetails: {
    orderType?: string;
    leverage?: number;
    entryPrice?: number;
  };

  @Column('json', { nullable: true })
  riskMetrics: {
    collateralRatio?: number;
    maintenanceMargin?: number;
    liquidationThreshold?: number;
  };

  @CreateDateColumn()
  createdAt: Date;
}

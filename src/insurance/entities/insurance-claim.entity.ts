import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { InsuranceFund } from './insurance-fund.entity';

export enum ClaimStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  PAID = 'PAID',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum ClaimReason {
  LIQUIDATION_LOSS = 'LIQUIDATION_LOSS',
  SLIPPAGE_PROTECTION = 'SLIPPAGE_PROTECTION',
  COUNTERPARTY_DEFAULT = 'COUNTERPARTY_DEFAULT',
  TECHNICAL_ERROR = 'TECHNICAL_ERROR',
  VOLATILITY_EVENT = 'VOLATILITY_EVENT',
}

@Entity('insurance_claim')
@Index(['fundId'])
@Index(['userId'])
@Index(['status'])
@Index(['createdAt'])
export class InsuranceClaim {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  fundId: number;

  @ManyToOne(() => InsuranceFund, { eager: true })
  @JoinColumn({ name: 'fundId' })
  fund: InsuranceFund;

  @Column()
  userId: number;

  @Column({
    type: 'enum',
    enum: ClaimStatus,
    default: ClaimStatus.PENDING,
  })
  status: ClaimStatus;

  @Column({
    type: 'enum',
    enum: ClaimReason,
  })
  reason: ClaimReason;

  @Column('decimal', {
    precision: 18,
    scale: 8,
  })
  claimAmount: number;

  @Column('decimal', {
    precision: 18,
    scale: 8,
    default: 0,
    comment: 'Amount actually paid',
  })
  paidAmount: number;

  @Column('decimal', {
    precision: 18,
    scale: 8,
    nullable: true,
    comment: 'Original loss amount',
  })
  originalLoss: number;

  @Column('decimal', {
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'Percentage of loss covered',
  })
  coveragePercentage: number;

  @Column('text')
  description: string;

  @Column('text', { nullable: true })
  liquidationEventReference: string;

  @Column('timestamp', { nullable: true })
  approvedAt: Date;

  @Column('timestamp', { nullable: true })
  paidAt: Date;

  @Column({ nullable: true })
  approvedBy: number;

  @Column('text', { nullable: true })
  rejectionReason: string;

  @Column('json', { nullable: true })
  metadata: {
    tradeId?: number;
    liquidationId?: number;
    assetSymbol?: string;
    volatilityIndex?: number;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

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

export enum ContributionType {
  TRADE_VOLUME = 'TRADE_VOLUME',
  MANUAL = 'MANUAL',
  PROTOCOL_REVENUE = 'PROTOCOL_REVENUE',
  INTEREST = 'INTEREST',
  PENALTY = 'PENALTY',
}

export enum ContributionStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

@Entity('insurance_contribution')
@Index(['userId'])
@Index(['fundId'])
@Index(['status'])
@Index(['createdAt'])
export class InsuranceContribution {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  fundId: number;

  @ManyToOne(() => InsuranceFund, { eager: true })
  @JoinColumn({ name: 'fundId' })
  fund: InsuranceFund;

  @Column({ nullable: true })
  userId: number;

  @Column({
    type: 'enum',
    enum: ContributionType,
    default: ContributionType.TRADE_VOLUME,
  })
  type: ContributionType;

  @Column({
    type: 'enum',
    enum: ContributionStatus,
    default: ContributionStatus.PENDING,
  })
  status: ContributionStatus;

  @Column('decimal', {
    precision: 18,
    scale: 8,
    default: 0,
  })
  amount: number;

  @Column('decimal', {
    precision: 5,
    scale: 4,
    nullable: true,
    comment: 'Contribution rate applied',
  })
  rate: number;

  @Column('text', { nullable: true, comment: 'Trade/transaction triggering contribution' })
  sourceReference: string;

  @Column('decimal', {
    precision: 18,
    scale: 8,
    nullable: true,
    comment: 'Base amount (before rate applied)',
  })
  baseAmount: number;

  @Column('text', { nullable: true })
  notes: string;

  @Column('json', { nullable: true })
  metadata: {
    tradeVolume?: number;
    tradeCount?: number;
    reason?: string;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

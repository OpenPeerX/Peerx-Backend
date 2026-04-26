import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Affiliate } from './affiliate.entity';

export enum AffiliatePayoutStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  PAID = 'PAID',
  FAILED = 'FAILED',
}

@Entity('affiliate_payouts')
@Index(['affiliateId'])
@Index(['status'])
@Index(['periodStart'])
export class AffiliatePayout {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  affiliateId: number;

  @Column('decimal', { precision: 18, scale: 8 })
  amount: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: AffiliatePayoutStatus.PENDING,
  })
  status: AffiliatePayoutStatus;

  @Column({ type: 'datetime' })
  periodStart: Date;

  @Column({ type: 'datetime' })
  periodEnd: Date;

  @Column({ nullable: true, length: 100 })
  transactionRef: string; // External payout reference

  @Column({ nullable: true, length: 500 })
  failureReason: string;

  @Column({ type: 'datetime', nullable: true })
  paidAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Affiliate)
  @JoinColumn({ name: 'affiliateId' })
  affiliate: Affiliate;
}

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
import { User } from '../../user/entities/user.entity';

export enum AffiliateStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  SUSPENDED = 'SUSPENDED',
  REJECTED = 'REJECTED',
}

export enum AffiliateCommissionTier {
  BRONZE = 'BRONZE', // 5%
  SILVER = 'SILVER', // 7.5%
  GOLD = 'GOLD',     // 10%
  PLATINUM = 'PLATINUM', // 15%
}

@Entity('affiliates')
@Index(['userId'], { unique: true })
@Index(['status'])
@Index(['commissionTier'])
@Index(['uniqueCode'], { unique: true })
export class Affiliate {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ unique: true })
  userId: number;

  @Column({ length: 24, unique: true })
  uniqueCode: string; // Unique tracking link code

  @Column({
    type: 'varchar',
    length: 20,
    default: AffiliateStatus.PENDING,
  })
  status: AffiliateStatus;

  @Column({
    type: 'varchar',
    length: 20,
    default: AffiliateCommissionTier.BRONZE,
  })
  commissionTier: AffiliateCommissionTier;

  @Column('decimal', { precision: 5, scale: 2, default: 5.0 })
  commissionRate: number; // Percentage

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  totalEarned: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  pendingPayout: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  totalPaidOut: number;

  @Column({ type: 'int', default: 0 })
  totalReferrals: number;

  @Column({ type: 'int', default: 0 })
  activeReferrals: number;

  @Column({ nullable: true, length: 500 })
  notes: string; // Admin notes

  @Column({ type: 'datetime', nullable: true })
  approvedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  nextPayoutDate: Date; // Monthly payout schedule

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;
}

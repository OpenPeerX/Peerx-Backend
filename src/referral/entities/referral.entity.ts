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

export enum ReferralStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  REWARDED = 'REWARDED',
  CANCELLED = 'CANCELLED',
}

@Entity('Referral')
@Index(['referrerId'])
@Index(['referredUserId'])
@Index(['status'])
export class Referral {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  referrerId: number;

  @Index()
  @Column()
  referredUserId: number;

  @Column({ unique: true })
  referralCode: string;

  @Column({
    type: 'varchar',
    default: ReferralStatus.PENDING,
  })
  status: ReferralStatus;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  pendingReward: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  earnedReward: number;

  @Column({ nullable: true })
  referredUserEmail: string;

  @Column({ nullable: true })
  referredUserUsername: string;

  @Column({ nullable: true })
  referredAt: Date;

  @Column({ nullable: true })
  rewardedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'referrerId' })
  referrer: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'referredUserId' })
  referredUser: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
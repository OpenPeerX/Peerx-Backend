import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Referral } from './referral.entity';

export enum RewardType {
  SIGNUP_BONUS = 'SIGNUP_BONUS',
  TRADING_REWARD = 'TRADING_REWARD',
  VOLUME_BONUS = 'VOLUME_BONUS',
  REFERRAL_COMMISSION = 'REFERRAL_COMMISSION',
}

@Entity('referral_rewards')
@Index(['referralId'])
@Index(['type'])
@Index(['createdAt'])
export class ReferralReward {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  referralId: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  amount: number;

  @Column({
    type: 'varchar',
    length: 50,
  })
  type: RewardType;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'datetime', nullable: true })
  creditedAt: Date;

  @Column({ nullable: true })
  description: string;

  @ManyToOne(() => Referral)
  @JoinColumn({ name: 'referralId' })
  referral: Referral;
}

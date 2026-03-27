import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('referral_config')
export class ReferralConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('decimal', { precision: 18, scale: 8, default: 10.0 })
  defaultRewardAmount: number;

  @Column('int', { default: 5 })
  minTradesRequired: number;

  @Column('decimal', { precision: 18, scale: 2, default: 100 })
  minTradeVolume: number;

  @Column('boolean', { default: true })
  enabled: boolean;

  @Column('int', { default: 30 })
  rewardExpiryDays: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0.05 })
  maxBonusMultiplier: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
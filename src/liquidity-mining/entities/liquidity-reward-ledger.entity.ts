import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

@Entity('liquidity_reward_ledgers')
@Unique(['stakeId'])
export class LiquidityRewardLedger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  stakeId: string;

  @Column()
  userId: number;

  @Column()
  poolId: string;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  accruedReward: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  vestedReward: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  claimedReward: number;

  @Column({ type: 'datetime', nullable: true })
  lastCalculatedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

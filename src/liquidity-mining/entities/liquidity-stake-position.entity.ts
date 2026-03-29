import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum LiquidityStakeStatus {
  ACTIVE = 'ACTIVE',
  UNSTAKED = 'UNSTAKED',
  FLAGGED = 'FLAGGED',
}

@Entity('liquidity_stake_positions')
export class LiquidityStakePosition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: number;

  @Column()
  poolId: string;

  @Column()
  programId: string;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  amount: number;

  @Column({ type: 'varchar', default: LiquidityStakeStatus.ACTIVE })
  status: LiquidityStakeStatus;

  @Column({ type: 'int', default: 0 })
  rapidCycleCount: number;

  @Column({ type: 'datetime' })
  stakedAt: Date;

  @Column({ type: 'datetime' })
  lastAccruedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  cooldownEndsAt?: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}

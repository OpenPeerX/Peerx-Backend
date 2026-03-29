import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum LiquidityProgramStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
}

@Entity('liquidity_mining_programs')
export class LiquidityMiningProgram {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  poolId: string;

  @Column({ type: 'datetime' })
  startAt: Date;

  @Column({ type: 'datetime' })
  endAt: Date;

  @Column({ type: 'int', default: 30 })
  vestingDays: number;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  rewardBudget: number;

  @Column({ type: 'varchar', default: LiquidityProgramStatus.ACTIVE })
  status: LiquidityProgramStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

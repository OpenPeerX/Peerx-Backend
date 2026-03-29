import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('liquidity_pools')
export class LiquidityPool {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  pairSymbol: string;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  currentDepth: number;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  targetDepth: number;

  @Column({ type: 'decimal', precision: 12, scale: 4 })
  baseApr: number;

  @Column()
  rewardToken: string;

  @Column()
  contractAddress: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

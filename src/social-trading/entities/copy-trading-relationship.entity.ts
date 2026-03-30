import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('copy_trading_relationships')
@Unique(['traderId', 'followerId'])
@Index(['traderId', 'isActive'])
@Index(['followerId', 'isActive'])
export class CopyTradingRelationship {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  traderId: number;

  @Column()
  followerId: number;

  @Column({ nullable: true })
  strategyId: number | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 25 })
  maxAllocationPercentage: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 1000 })
  maxTradeAmount: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 8 })
  stopLossPercentage: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 5 })
  dailyLossLimitPercentage: number;

  @Column({ type: 'decimal', precision: 8, scale: 4, default: 1 })
  copyRatio: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 1 })
  slippageTolerancePercentage: number;

  @Column({ default: true })
  autoExecute: boolean;

  @Column({ nullable: true })
  lastSyncedTradeId: number | null;

  @Column({ type: 'int', default: 0 })
  totalCopiedTrades: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  copiedVolume: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  realizedPnl: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
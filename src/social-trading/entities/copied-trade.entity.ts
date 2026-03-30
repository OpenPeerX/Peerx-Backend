import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum CopiedTradeStatus {
  EXECUTED = 'EXECUTED',
  SKIPPED = 'SKIPPED',
  FAILED = 'FAILED',
}

@Entity('copied_trades')
@Index(['relationshipId', 'createdAt'])
@Index(['traderId', 'status'])
@Index(['followerId', 'status'])
export class CopiedTrade {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  relationshipId: number;

  @Column()
  sourceTradeId: number;

  @Column()
  traderId: number;

  @Column()
  followerId: number;

  @Column({ length: 32 })
  asset: string;

  @Column({ length: 12 })
  side: string;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  requestedAmount: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  executedAmount: number;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  sourcePrice: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  executedPrice: number;

  @Column({
    type: 'varchar',
    length: 16,
    default: CopiedTradeStatus.EXECUTED,
  })
  status: CopiedTradeStatus;

  @Column({ default: false })
  riskAdjusted: boolean;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  realizedPnl: number;

  @Column({ type: 'varchar', nullable: true })
  failureReason: string | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'datetime', nullable: true })
  executedAt: Date | null;
}
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity()
@Index(['userId', 'calculatedAt'])
export class RiskMetrics {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  userId: number;

  // Value at Risk
  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  var95: number;

  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  var99: number;

  // Risk-adjusted returns
  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  sharpeRatio: number;

  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  sortinoRatio: number;

  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  calmarRatio: number;

  // Drawdown metrics
  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  maxDrawdown: number;

  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  currentDrawdown: number;

  @Column('int', { nullable: true })
  maxDrawdownDuration: number;

  // Volatility metrics
  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  volatility: number;

  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  annualizedVolatility: number;

  // Beta and Alpha
  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  beta: number;

  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  alpha: number;

  @Column({ nullable: true })
  benchmark: string;

  @Column()
  @Index()
  calculatedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}

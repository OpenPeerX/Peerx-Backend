import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum PerformancePeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

@Entity()
@Index(['userId', 'period', 'date'])
export class PerformanceHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  userId: number;

  @Column({
    type: 'simple-enum',
    enum: PerformancePeriod,
  })
  period: PerformancePeriod;

  @Column()
  @Index()
  date: Date;

  @Column('decimal', { precision: 20, scale: 8 })
  startValue: number;

  @Column('decimal', { precision: 20, scale: 8 })
  endValue: number;

  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  return: number;

  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  benchmarkReturn: number;

  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  excessReturn: number;

  @Column('json', { nullable: true })
  attribution: Record<string, number>;

  @Column('int', { nullable: true })
  tradingDays: number;

  @Column('int', { nullable: true })
  totalTrades: number;

  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  winRate: number;

  @CreateDateColumn()
  createdAt: Date;
}

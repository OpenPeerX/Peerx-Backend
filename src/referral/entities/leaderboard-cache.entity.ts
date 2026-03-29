import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

export enum LeaderboardPeriod {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  ALL_TIME = 'ALL_TIME',
}

export enum LeaderboardType {
  REFERRALS = 'REFERRALS',
  TRADING_VOLUME = 'TRADING_VOLUME',
  TOTAL_SCORE = 'TOTAL_SCORE',
}

@Entity('leaderboard_cache')
@Index(['type', 'period', 'rank'])
@Index(['userId'])
@Unique(['type', 'period', 'userId'])
export class LeaderboardCache {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'varchar',
    length: 50,
  })
  type: LeaderboardType;

  @Column()
  userId: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  score: number;

  @Column({ default: 0 })
  rank: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: LeaderboardPeriod.ALL_TIME,
  })
  period: LeaderboardPeriod;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'datetime' })
  periodStart: Date;

  @Column({ type: 'datetime', nullable: true })
  periodEnd: Date;
}

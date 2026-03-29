import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('risk_profiles')
@Index(['userId'])
export class RiskProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  userId: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  dailyVaR: number;

  @Column('decimal', { precision: 10, scale: 4, default: 0 })
  sharpeRatio: number;

  @Column('decimal', { precision: 10, scale: 4, default: 0 })
  maxDrawdown: number;

  @Column('decimal', { precision: 10, scale: 4, default: 0.1 })
  maxDrawdownLimit: number; // e.g. 0.1 = 10% maximum tolerance before alerting

  @Column('decimal', { precision: 10, scale: 4, default: 0.25 })
  positionLimit: number; // e.g., max 25% of portfolio in a single asset

  @Column({ type: 'datetime', nullable: true })
  lastCalculatedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

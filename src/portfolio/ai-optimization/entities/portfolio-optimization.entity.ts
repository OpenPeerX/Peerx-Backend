import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';

export enum OptimizationStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum RiskTolerance {
  CONSERVATIVE = 'conservative',
  MODERATE = 'moderate',
  AGGRESSIVE = 'aggressive',
  VERY_AGGRESSIVE = 'very_aggressive',
}

@Entity('portfolio_optimizations')
export class PortfolioOptimizationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'enum',
    enum: RiskTolerance,
  })
  riskTolerance: RiskTolerance;

  @Column({ type: 'json' })
  currentAllocation: Record<string, number>;

  @Column({ type: 'json' })
  optimizedAllocation: Record<string, number>;

  @Column({ type: 'decimal', precision: 10, scale: 4 })
  expectedReturn: number;

  @Column({ type: 'decimal', precision: 10, scale: 4 })
  expectedRisk: number;

  @Column({ type: 'decimal', precision: 10, scale: 4 })
  sharpeRatio: number;

  @Column({
    type: 'enum',
    enum: OptimizationStatus,
    default: OptimizationStatus.PENDING,
  })
  status: OptimizationStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'json', nullable: true })
  optimizationMetrics: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  constraints: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'executed_at', nullable: true })
  executedAt: Date;
}

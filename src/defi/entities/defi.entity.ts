/**
 * DeFi Position Entity
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';

@Entity('defi_positions')
@Index(['userId', 'protocol'])
@Index(['userId', 'status'])
@Index(['protocol', 'status'])
export class DeFiPositionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  protocol: string;

  @Column()
  action: 'deposit' | 'borrow' | 'stake' | 'farm';

  @Column()
  tokenIn: string;

  @Column({ nullable: true })
  tokenOut?: string;

  @Column('decimal', { precision: 30, scale: 8 })
  amountIn: string;

  @Column('decimal', { precision: 30, scale: 8, nullable: true })
  amountOut?: string;

  @Column('decimal', { precision: 30, scale: 8, nullable: true })
  shares?: string;

  @Column('bigint')
  startTimestamp: number;

  @Column('bigint', { nullable: true })
  endTimestamp?: number;

  @Column({ type: 'varchar', default: 'active' })
  status: 'active' | 'closed' | 'liquidated';

  @Column('decimal', { precision: 10, scale: 6, nullable: true })
  apy?: number;

  @Column({ nullable: true })
  riskLevel?: 'low' | 'medium' | 'high';

  @Column('decimal', { precision: 30, scale: 8, nullable: true })
  collateral?: string;

  @Column('decimal', { precision: 30, scale: 8, nullable: true })
  borrowed?: string;

  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  healthFactor?: number;

  // Transaction tracking
  @Column({ nullable: true })
  transactionHash?: string;

  @Column('decimal', { precision: 30, scale: 8, nullable: true })
  gasUsed?: string;

  @Column('decimal', { precision: 18, scale: 8, nullable: true })
  gasPrice?: string;

  // Additional metadata
  @Column('json', { nullable: true })
  metadata?: Record<string, any>;

  @Column('json', { nullable: true })
  strategyConfig?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => DeFiTransactionEntity, (tx) => tx.position, { cascade: true })
  transactions: DeFiTransactionEntity[];

  @OneToMany(() => DeFiYieldEntity, (yield) => yield.position, { cascade: true })
  yieldHistory: DeFiYieldEntity[];
}

@Entity('defi_transactions')
@Index(['positionId', 'createdAt'])
export class DeFiTransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  positionId: string;

  @Column()
  userId: string;

  @Column()
  protocol: string;

  @Column()
  type: string;

  @Column()
  transactionHash: string;

  @Column()
  status: 'pending' | 'confirmed' | 'failed';

  @Column('decimal', { precision: 30, scale: 8 })
  amount: string;

  @Column('decimal', { precision: 21, scale: 8, nullable: true })
  gasUsed?: string;

  @Column('decimal', { precision: 21, scale: 8, nullable: true })
  gasPrice?: string;

  @Column('json', { nullable: true })
  error?: Record<string, any>;

  @Column('bigint')
  blockNumber?: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column()
  positionId_fk: string;

  @ManyToOne(() => DeFiPositionEntity, (position) => position.transactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'positionId_fk' })
  position: DeFiPositionEntity;
}

@Entity('defi_yield')
@Index(['positionId', 'createdAt'])
export class DeFiYieldEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  positionId: string;

  @Column()
  protocol: string;

  @Column('decimal', { precision: 30, scale: 8 })
  earnedAmount: string;

  @Column('decimal', { precision: 30, scale: 8 })
  earnedValue: string;

  @Column('decimal', { precision: 10, scale: 6 })
  apy: number;

  @Column('decimal', { precision: 10, scale: 6 })
  apr: number;

  @Column()
  frequency: 'daily' | 'weekly' | 'monthly' | 'continuous';

  @CreateDateColumn()
  createdAt: Date;

  @Column()
  positionId_fk: string;

  @ManyToOne(() => DeFiPositionEntity, (position) => position.yieldHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'positionId_fk' })
  position: DeFiPositionEntity;
}

@Entity('defi_strategies')
@Index(['userId', 'status'])
export class DeFiStrategyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column()
  protocol: string;

  @Column('decimal', { precision: 10, scale: 6 })
  expectedAPY: number;

  @Column()
  riskLevel: 'low' | 'medium' | 'high';

  @Column('decimal', { precision: 30, scale: 8 })
  minInvestment: string;

  @Column('decimal', { precision: 30, scale: 8 })
  maxInvestment: string;

  @Column('bigint')
  lockupPeriod: number;

  @Column()
  complexity: 'beginner' | 'intermediate' | 'advanced';

  @Column('json')
  composition: Record<string, any>[];

  @Column('json', { nullable: true })
  config?: Record<string, any>;

  @Column({ default: true })
  enabled: boolean;

  @Column({
    type: 'varchar',
    default: 'inactive',
  })
  status: 'active' | 'inactive' | 'paused';

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('defi_risk_assessments')
@Index(['userId', 'createdAt'])
export class DeFiRiskAssessmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  positionId?: string;

  @Column('decimal', { precision: 10, scale: 2 })
  riskScore: number;

  @Column()
  riskLevel: 'low' | 'medium' | 'high' | 'critical';

  @Column('json')
  factors: Record<string, any>[];

  @Column('json')
  recommendations: string[];

  @Column('decimal', { precision: 18, scale: 8, nullable: true })
  liquidationPrice?: string;

  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  healthFactor?: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  volatilityScore?: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
  EMERGENCY = 'EMERGENCY',
}

@Entity('fund_health_metrics')
@Index(['fundId'])
@Index(['createdAt'])
export class FundHealthMetrics {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  fundId: number;

  @Column({
    type: 'enum',
    enum: HealthStatus,
    default: HealthStatus.HEALTHY,
  })
  healthStatus: HealthStatus;

  @Column('decimal', { precision: 20, scale: 8, comment: 'Current fund balance' })
  currentBalance: number;

  @Column('decimal', { precision: 5, scale: 2, comment: 'Balance as % of target' })
  fundingLevel: number; // 0-100%

  @Column('decimal', { precision: 5, scale: 2, comment: 'Reserve capacity ratio' })
  reserveCapacity: number;

  @Column('int', {
    comment: 'Days until depletion at current burn rate',
  })
  daysToDepletion: number;

  @Column('decimal', {
    precision: 18,
    scale: 8,
    comment: 'Average daily payout amount',
  })
  averageDailyPayout: number;

  @Column('decimal', {
    precision: 18,
    scale: 8,
    comment: 'Average daily contribution',
  })
  averageDailyContribution: number;

  @Column('decimal', { precision: 5, scale: 2, comment: 'Burn rate ratio' })
  burnRate: number;

  @Column('int', {
    comment: 'Number of active liquidation threats',
  })
  activeThreats: number;

  @Column('decimal', {
    precision: 18,
    scale: 8,
    comment: 'Estimated loss in next 7 days',
  })
  projectedLoss7d: number;

  @Column('decimal', {
    precision: 18,
    scale: 8,
    comment: 'Total pending claims',
  })
  pendingClaimAmount: number;

  @Column('decimal', { precision: 18, scale: 8, comment: 'Market volatility index' })
  volatilityIndex: number;

  @Column('boolean', {
    default: false,
    comment: 'Auto-refill triggered',
  })
  autoRefillTriggered: boolean;

  @Column('boolean', {
    default: false,
    comment: 'Emergency mode active',
  })
  emergencyModeActive: boolean;

  @Column('text', { nullable: true, comment: 'Alerts and warnings' })
  alerts: string;

  @Column('json', { nullable: true, comment: 'Historical trends' })
  trends: {
    weeklyChange?: number;
    monthlyChange?: number;
    volatilityTrend?: string;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

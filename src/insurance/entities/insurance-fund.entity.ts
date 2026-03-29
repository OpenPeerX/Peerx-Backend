import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum FundStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  DEPLETED = 'DEPLETED',
  RECOVERING = 'RECOVERING',
}

export enum FundType {
  PRIMARY = 'PRIMARY',
  EMERGENCY = 'EMERGENCY',
  USER_CONTRIBUTED = 'USER_CONTRIBUTED',
}

@Entity('insurance_fund')
@Index(['fundType'])
@Index(['status'])
export class InsuranceFund {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: FundType,
    default: FundType.PRIMARY,
  })
  fundType: FundType;

  @Column({
    type: 'enum',
    enum: FundStatus,
    default: FundStatus.ACTIVE,
  })
  status: FundStatus;

  @Column('decimal', {
    precision: 20,
    scale: 8,
    default: 0,
    comment: 'Total balance in the fund',
  })
  balance: number;

  @Column('decimal', {
    precision: 20,
    scale: 8,
    default: 0,
    comment: 'Minimum balance threshold',
  })
  minimumBalance: number;

  @Column('decimal', {
    precision: 20,
    scale: 8,
    default: 0,
    comment: 'Target balance for auto-refill',
  })
  targetBalance: number;

  @Column('decimal', {
    precision: 18,
    scale: 8,
    default: 0,
    comment: 'Total accumulated contributions',
  })
  totalContributions: number;

  @Column('decimal', {
    precision: 18,
    scale: 8,
    default: 0,
    comment: 'Total paid out for claims',
  })
  totalPayouts: number;

  @Column('int', { default: 0, comment: 'Number of claims paid' })
  claimCount: number;

  @Column('int', { default: 0, comment: 'Number of liquidations covered' })
  liquidationsCovered: number;

  @Column('decimal', {
    precision: 5,
    scale: 2,
    default: 10,
    comment: 'Coverage percentage (0-100)',
  })
  coverageRatio: number; // What % of bad debt can be covered

  @Column('decimal', {
    precision: 5,
    scale: 4,
    default: 0.01,
    comment: 'Contribution rate as % of trade volume',
  })
  contributionRate: number;

  @Column('boolean', { default: false })
  autoRefillEnabled: boolean;

  @Column('decimal', {
    precision: 5,
    scale: 4,
    default: 0,
    comment: 'Interest rate for fund growth',
  })
  interestRate: number;

  @Column('text', { nullable: true })
  description: string;

  @Column('json', { nullable: true })
  config: {
    maxClaimSize?: number;
    maxDailyPayouts?: number;
    claimDelay?: number; // in seconds
    autoRefillThreshold?: number;
    emergencyTriggerLevel?: number;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

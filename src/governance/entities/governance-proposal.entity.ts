import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ProposalStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  SUCCEEDED = 'SUCCEEDED',
  DEFEATED = 'DEFEATED',
  EXECUTED = 'EXECUTED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

@Entity('governance_proposals')
export class GovernanceProposal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column()
  proposerUserId: number;

  @Column({ type: 'varchar', default: ProposalStatus.ACTIVE })
  status: ProposalStatus;

  @Column({ type: 'datetime' })
  startAt: Date;

  @Column({ type: 'datetime' })
  endAt: Date;

  @Column({ type: 'datetime' })
  snapshotAt: Date;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  quorumThreshold: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  yesPower: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  noPower: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  abstainPower: number;

  @Column({ type: 'boolean', default: false })
  executable: boolean;

  @Column({ type: 'simple-json', nullable: true })
  executionResult?: Record<string, unknown>;

  @Column({ type: 'datetime', nullable: true })
  executedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

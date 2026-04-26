import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export enum BugReportSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum BugReportStatus {
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  BONUS_PAID = 'BONUS_PAID',
  DUPLICATE = 'DUPLICATE',
}

/** Token bonus amounts per severity */
export const SEVERITY_BONUS_MAP: Record<BugReportSeverity, number> = {
  [BugReportSeverity.LOW]: 10,
  [BugReportSeverity.MEDIUM]: 50,
  [BugReportSeverity.HIGH]: 150,
  [BugReportSeverity.CRITICAL]: 500,
};

@Entity('bug_reports')
@Index(['reporterId'])
@Index(['status'])
@Index(['severity'])
@Index(['createdAt'])
export class BugReport {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  reporterId: number;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  stepsToReproduce: string;

  @Column({ type: 'text', nullable: true })
  expectedBehavior: string;

  @Column({ type: 'text', nullable: true })
  actualBehavior: string;

  @Column({ length: 255, nullable: true })
  affectedVersion: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: BugReportSeverity.LOW,
  })
  severity: BugReportSeverity;

  @Column({
    type: 'varchar',
    length: 20,
    default: BugReportStatus.SUBMITTED,
  })
  status: BugReportStatus;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  bonusAmount: number; // Token amount to be awarded

  @Column({ nullable: true, length: 500 })
  reviewerNotes: string; // Admin feedback

  @Column({ nullable: true })
  reviewedBy: number; // Admin userId

  @Column({ type: 'datetime', nullable: true })
  reviewedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  bonusPaidAt: Date;

  @Column({ nullable: true, length: 100 })
  duplicateOfId: string; // Reference to existing bug if duplicate

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reporterId' })
  reporter: User;
}

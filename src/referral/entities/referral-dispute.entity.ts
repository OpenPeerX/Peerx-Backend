import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { DisputeStatus } from '../dto/referral-admin.dto';

@Entity('referral_disputes')
@Index(['referralId'])
@Index(['status'])
@Index(['createdAt'])
export class ReferralDispute {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('int')
  referralId: number;

  @Column('int')
  userId: number;

  @Column({
    type: 'varchar',
    default: DisputeStatus.PENDING,
  })
  status: DisputeStatus;

  @Column('text')
  reason: string;

  @Column('text')
  description: string;

  @Column({ nullable: true })
  resolution: string;

  @Column({ nullable: true })
  resolvedAt: Date;

  @Column({ nullable: true, type: 'decimal', precision: 18, scale: 8 })
  compensationAmount: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
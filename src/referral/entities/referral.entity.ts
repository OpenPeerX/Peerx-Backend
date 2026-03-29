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

export enum ReferralStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  ACTIVE = 'ACTIVE',
  REWARDED = 'REWARDED',
  EXPIRED = 'EXPIRED',
}

@Entity('referrals')
@Index(['referrerId'])
@Index(['referredUserId'])
@Index(['status'])
@Index(['createdAt'])
export class Referral {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  referrerId: number;

  @Index()
  @Column()
  referredUserId: number;

  @Column({
    type: 'varchar',
    default: ReferralStatus.PENDING,
    length: 20,
  })
  status: ReferralStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  rewardedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  verifiedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'referrerId' })
  referrer: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'referredUserId' })
  referredUser: User;
}

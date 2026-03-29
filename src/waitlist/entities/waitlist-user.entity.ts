import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

export enum WaitlistStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  INVITED = 'invited',
  EXCLUDED = 'excluded',
}

@Entity('waitlist_users')
@Index(['email'], { unique: true })
@Index(['status'])
@Index(['referralCode'])
@Index(['createdAt'])
export class WaitlistUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ nullable: true, length: 255 })
  name: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: WaitlistStatus.PENDING,
  })
  status: WaitlistStatus;

  @Column({ nullable: true, length: 12 })
  referralCode: string;

  @Column({ nullable: true, length: 255 })
  referralSource: string;

  @Column({ type: 'datetime', nullable: true })
  verifiedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  invitedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

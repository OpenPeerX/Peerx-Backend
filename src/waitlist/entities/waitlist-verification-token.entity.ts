import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { WaitlistUser } from './waitlist-user.entity';

@Entity('waitlist_verification_tokens')
@Index(['token'], { unique: true })
@Index(['email'])
@Index(['expiresAt'])
export class WaitlistVerificationToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  email: string;

  @Column({ unique: true, length: 64 })
  token: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'datetime' })
  expiresAt: Date;

  @Column({ default: false })
  isUsed: boolean;

  @Column({ type: 'datetime', nullable: true })
  usedAt: Date;

  @ManyToOne(() => WaitlistUser, { nullable: true })
  @JoinColumn({ name: 'email', referencedColumnName: 'email' })
  waitlistUser: WaitlistUser;
}

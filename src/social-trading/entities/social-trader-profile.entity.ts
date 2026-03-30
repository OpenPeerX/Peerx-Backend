import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('social_trader_profiles')
@Unique(['userId'])
@Index(['score'])
export class SocialTraderProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  userId: number;

  @Column({ length: 120 })
  displayName: string;

  @Column({ type: 'text', nullable: true })
  biography: string | null;

  @Column({ length: 120, nullable: true })
  specialty: string | null;

  @Column({ length: 24, default: 'BALANCED' })
  riskAppetite: string;

  @Column({ length: 24, default: 'INTERMEDIATE' })
  experienceLevel: string;

  @Column({ default: true })
  isPublic: boolean;

  @Column({ default: false })
  verified: boolean;

  @Column({ type: 'int', default: 0 })
  totalFollowers: number;

  @Column({ type: 'int', default: 0 })
  totalStrategies: number;

  @Column({ type: 'int', default: 0 })
  totalLikes: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  copiedAssetsUnderManagement: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  revenueShareEarned: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  score: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('learning_profiles')
@Index(['userId'])
@Index(['totalPoints'])
export class LearningProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', unique: true })
  userId: number;

  // Core metrics
  @Column({ type: 'int', default: 0 })
  totalPoints: number;

  @Column({ type: 'int', default: 0 })
  tutorialsCompleted: number;

  @Column({ type: 'int', default: 0 })
  totalQuizScore: number;

  @Column({ type: 'int', default: 0 })
  averageQuizScore: number;

  // Engagement metrics
  @Column({ type: 'int', default: 0 })
  currentStreak: number;

  @Column({ type: 'int', default: 0 })
  longestStreak: number;

  @Column({ nullable: true })
  lastActivityDate?: Date;

  @Column({ type: 'int', default: 0 })
  consecutiveDays: number;

  // Module-specific progress
  @Column('jsonb', { default: [] })
  completedModules: string[];

  @Column('jsonb', { default: {} })
  moduleScores: Record<string, number>;

  // Badges and achievements
  @Column('jsonb', { default: [] })
  earnedBadges: string[];

  @Column({ type: 'varchar', length: 50, default: 'BEGINNER' })
  learningLevel: LearningLevel;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  lastCalculatedAt?: Date;
}

export enum LearningLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
  EXPERT = 'EXPERT',
  MASTER = 'MASTER',
}

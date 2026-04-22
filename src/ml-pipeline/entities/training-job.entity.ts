import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum TrainingJobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity()
@Index(['status', 'createdAt'])
export class TrainingJob {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  jobId: string;

  @Column()
  modelName: string;

  @Column({ type: 'simple-enum', enum: TrainingJobStatus })
  status: TrainingJobStatus;

  @Column('json')
  configuration: Record<string, any>;

  @Column('json', { nullable: true })
  hyperparameters: Record<string, any>;

  @Column('json', { nullable: true })
  metrics: Record<string, number>;

  @Column('text', { nullable: true })
  errorMessage: string;

  @Column({ nullable: true })
  startedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

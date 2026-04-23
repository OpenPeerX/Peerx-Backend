import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum DeploymentStatus {
  STAGING = 'staging',
  PRODUCTION = 'production',
  ARCHIVED = 'archived',
}

@Entity()
@Index(['modelName', 'version'])
export class ModelVersion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  modelName: string;

  @Column()
  version: string;

  @Column('json')
  hyperparameters: Record<string, any>;

  @Column('json')
  performanceMetrics: Record<string, number>;

  @Column({ type: 'simple-enum', enum: DeploymentStatus, default: DeploymentStatus.STAGING })
  deploymentStatus: DeploymentStatus;

  @Column({ nullable: true })
  trainingJobId: number;

  @Column('text', { nullable: true })
  modelPath: string;

  @Column({ default: false })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

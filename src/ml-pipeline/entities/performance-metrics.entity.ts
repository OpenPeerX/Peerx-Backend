import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity()
@Index(['modelVersionId', 'evaluatedAt'])
export class PerformanceMetrics {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  modelVersionId: number;

  @Column('decimal', { precision: 10, scale: 4 })
  accuracy: number;

  @Column('decimal', { precision: 10, scale: 4 })
  precision: number;

  @Column('decimal', { precision: 10, scale: 4 })
  recall: number;

  @Column('decimal', { precision: 10, scale: 4 })
  f1Score: number;

  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  auc: number;

  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  backtestReturn: number;

  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  sharpeRatio: number;

  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  maxDrawdown: number;

  @Column('json', { nullable: true })
  statisticalTests: Record<string, number>;

  @Column()
  evaluatedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}

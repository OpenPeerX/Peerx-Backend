import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity()
@Index(['exchange'])
export class ExchangeHealth {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  exchange: string;

  @Column({ default: true })
  isConnected: boolean;

  @Column('int', { nullable: true })
  responseTime: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  errorRate: number;

  @Column('int', { default: 0 })
  totalRequests: number;

  @Column('int', { default: 0 })
  failedRequests: number;

  @Column({ nullable: true })
  lastPriceUpdate: Date;

  @Column({ nullable: true })
  lastHealthCheck: Date;

  @Column('text', { nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

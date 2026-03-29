import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('shared_strategies')
@Index(['traderId', 'isActive'])
@Index(['asset', 'riskLevel'])
export class SharedStrategy {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  traderId: number;

  @Column({ length: 160 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ length: 32 })
  asset: string;

  @Column({ length: 32, default: 'SPOT' })
  marketType: string;

  @Column({ length: 24, default: 'BALANCED' })
  riskLevel: string;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  minimumCapital: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 25 })
  allocationPercentage: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 8 })
  stopLossPercentage: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 15 })
  takeProfitPercentage: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ length: 24, default: 'PUBLIC' })
  visibility: string;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[] | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
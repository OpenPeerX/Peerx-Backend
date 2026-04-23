import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity()
@Index(['userId', 'timestamp'])
export class PortfolioSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column('decimal', { precision: 20, scale: 8 })
  totalValue: number;

  @Column('decimal', { precision: 20, scale: 8, nullable: true })
  previousValue: number;

  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  profitLoss: number;

  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  returns: number;

  @Column('json', { nullable: true })
  assetAllocation: Record<string, number>;

  @Column('json', { nullable: true })
  assetValues: Record<string, number>;

  @Column()
  @Index()
  timestamp: Date;

  @CreateDateColumn()
  createdAt: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('trader_revenue_shares')
@Index(['traderId', 'period'])
export class TraderRevenueShare {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  traderId: number;

  @Column({ length: 24 })
  period: string;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  grossRevenue: number;

  @Column({ type: 'decimal', precision: 8, scale: 4, default: 0 })
  platformCommissionRate: number;

  @Column({ type: 'decimal', precision: 8, scale: 4, default: 0 })
  traderShareRate: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  traderPayout: number;

  @Column({ type: 'int', default: 0 })
  ranking: number;

  @Column({ type: 'int', default: 0 })
  followerCountSnapshot: number;

  @CreateDateColumn()
  createdAt: Date;
}
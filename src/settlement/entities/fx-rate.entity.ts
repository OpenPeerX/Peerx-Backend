import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('fx_rates')
@Index(['fromCurrency', 'toCurrency', 'timestamp'])
@Index(['source', 'timestamp'])
@Index(['expiration'])
export class FXRate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 10 })
  fromCurrency: string;

  @Column({ type: 'varchar', length: 10 })
  toCurrency: string;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  rate: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  minRate: number; // Lowest rate seen

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  maxRate: number; // Highest rate seen

  @Column({ type: 'varchar', length: 50 })
  source: string; // CoinGecko, Bloomberg, Chainlink, Internal, etc.

  @Column({ type: 'text', nullable: true })
  sourceUrl: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  confidence: number; // 0-100, how confident we are in the rate

  @CreateDateColumn()
  timestamp: Date;

  @Column({ type: 'timestamp' })
  expiration: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // Rate history tracking
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  changePercent24h: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  changePercent7d: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  volatilityIndex: number; // 0-100

  @Column({ type: 'integer', nullable: true })
  volume24h: number;

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @UpdateDateColumn()
  updatedAt: Date;
}

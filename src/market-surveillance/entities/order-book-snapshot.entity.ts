import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

@Entity('order_book_snapshots')
@Index(['tradingPair', 'timestamp'])
@Index(['timestamp'])
export class OrderBookSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  tradingPair: string;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  midPrice: number;

  @Column({ type: 'jsonb' })
  bids: Array<{
    price: number;
    quantity: number;
    orderId: string;
    actorId: string;
  }>;

  @Column({ type: 'jsonb' })
  asks: Array<{
    price: number;
    quantity: number;
    orderId: string;
    actorId: string;
  }>;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  bidVolume: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  askVolume: number;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  spread: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  spreadPercent: number;

  @Column({ type: 'integer' })
  bidCount: number;

  @Column({ type: 'integer' })
  askCount: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  totalVolume24h: number;

  @Column({ type: 'integer' })
  tradeCount: number;

  // Microstructure metrics
  @Column({ type: 'jsonb', nullable: true })
  microstructure: {
    volatility?: number;
    bidAskImbalance?: number;
    priceImpact?: number;
    orderFlowImbalance?: number;
  };

  @CreateDateColumn()
  timestamp: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}

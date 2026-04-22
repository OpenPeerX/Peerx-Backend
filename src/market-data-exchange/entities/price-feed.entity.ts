import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity()
@Index(['exchange', 'symbol', 'timestamp'])
export class PriceFeed {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  exchange: string;

  @Column()
  symbol: string;

  @Column('decimal', { precision: 20, scale: 8 })
  price: number;

  @Column('decimal', { precision: 20, scale: 8, nullable: true })
  bid: number;

  @Column('decimal', { precision: 20, scale: 8, nullable: true })
  ask: number;

  @Column('decimal', { precision: 20, scale: 8, nullable: true })
  volume: number;

  @Column('int', { nullable: true })
  latency: number;

  @Column({ default: true })
  isValid: boolean;

  @Column()
  timestamp: Date;

  @CreateDateColumn()
  createdAt: Date;
}

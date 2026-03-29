import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum OptionOrderSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum OptionOrderType {
  MARKET = 'MARKET',
  LIMIT = 'LIMIT',
}

export enum OptionOrderStatus {
  OPEN = 'OPEN',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  FILLED = 'FILLED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

@Entity('option_orders')
export class OptionOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  contractId: string;

  @Column()
  userId: number;

  @Column({ type: 'varchar' })
  side: OptionOrderSide;

  @Column({ type: 'varchar' })
  orderType: OptionOrderType;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  quantity: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  limitPrice?: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  filledQuantity: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  averageFillPrice: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  marginRequirement: number;

  @Column({ type: 'simple-json', nullable: true })
  greeks?: Record<string, number>;

  @Column({ type: 'varchar', default: OptionOrderStatus.OPEN })
  status: OptionOrderStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

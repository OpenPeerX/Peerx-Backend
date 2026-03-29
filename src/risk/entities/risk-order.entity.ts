import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum RiskOrderType {
  STOP_LOSS = 'STOP_LOSS',
  TAKE_PROFIT = 'TAKE_PROFIT',
}

export enum RiskOrderSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum RiskOrderStatus {
  PENDING = 'PENDING',
  EXECUTED = 'EXECUTED',
  CANCELLED = 'CANCELLED',
}

@Entity('risk_orders')
@Index(['status'])
@Index(['userId', 'status'])
@Index(['asset', 'status'])
export class RiskOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  userId: number;

  @Column()
  asset: string;

  @Column({ type: 'varchar' })
  orderType: RiskOrderType;

  @Column({ type: 'varchar' })
  side: RiskOrderSide;

  @Column('decimal', { precision: 18, scale: 8 })
  amount: number;

  @Column('decimal', { precision: 18, scale: 8 })
  triggerPrice: number;

  @Column({ type: 'varchar', default: RiskOrderStatus.PENDING })
  status: RiskOrderStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  executedAt?: Date;

  @Column({ nullable: true })
  executionPrice?: number;
}

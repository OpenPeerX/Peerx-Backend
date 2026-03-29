import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

@Entity('option_positions')
@Unique(['contractId', 'userId'])
export class OptionPosition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  contractId: string;

  @Column()
  userId: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  longQuantity: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  shortQuantity: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  averageEntryPrice: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  marginHeld: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  realizedPnl: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  unrealizedPnl: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

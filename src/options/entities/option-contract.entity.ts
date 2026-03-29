import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum OptionType {
  CALL = 'CALL',
  PUT = 'PUT',
}

export enum OptionContractStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  SETTLED = 'SETTLED',
}

@Entity('option_contracts')
export class OptionContract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  underlyingAsset: string;

  @Column({ type: 'varchar' })
  optionType: OptionType;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  strikePrice: number;

  @Column({ type: 'datetime' })
  expiryAt: Date;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 1 })
  contractSize: number;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  markPrice: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0.5 })
  volatility: number;

  @Column({ type: 'varchar', default: OptionContractStatus.ACTIVE })
  status: OptionContractStatus;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  settlementPrice?: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

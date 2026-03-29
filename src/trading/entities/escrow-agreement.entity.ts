import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum EscrowStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  EXECUTED = 'EXECUTED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

@Entity('escrow_agreements')
@Index(['walletId', 'status'])
@Index(['tradeId'])
export class EscrowAgreement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', nullable: true })
  tradeId: number;

  @Column({ type: 'uuid' })
  walletId: string;

  @Column({ type: 'int' })
  chainId: number;

  @Column({ type: 'varchar', length: 80 })
  buyer: string;

  @Column({ type: 'varchar', length: 80 })
  seller: string;

  @Column({ type: 'varchar', length: 32 })
  asset: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  tokenAddress: string;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  amount: number;

  @Column({
    type: 'simple-enum',
    enum: EscrowStatus,
    default: EscrowStatus.PENDING_APPROVAL,
  })
  status: EscrowStatus;

  @Column({ type: 'int' })
  requiredApprovals: number;

  @Column({ type: 'int', default: 0 })
  approvedCount: number;

  @Column({ type: 'varchar', length: 80, nullable: true })
  executedTxHash: string;

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date;

  @Column('simple-json', { nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

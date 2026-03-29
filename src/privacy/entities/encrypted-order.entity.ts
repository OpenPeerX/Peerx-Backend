import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum EncryptedOrderStatus {
  PENDING = 'PENDING',
  MATCHED = 'MATCHED',
  CANCELLED = 'CANCELLED',
  EXECUTED = 'EXECUTED',
  EXPIRED = 'EXPIRED',
}

@Entity('encrypted_order')
@Index(['pseudonymousId'])
@Index(['createdAt'])
@Index(['status'])
export class EncryptedOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', comment: 'Reference to pseudonymous user' })
  pseudonymousId: string;

  @Column({
    type: 'text',
    comment: 'AES-256-GCM encrypted order details',
  })
  encryptedOrderDetails: string;

  @Column({
    type: 'varchar',
    length: 64,
    comment: 'HMAC hash for integrity verification',
  })
  orderHash: string;

  @Column({
    type: 'varchar',
    length: 32,
    comment: 'Base64 encoded encryption nonce (GCM IV)',
  })
  encryptionNonce: string;

  @Column({
    type: 'json',
    nullable: true,
    comment: 'Non-sensitive metadata: symbol, side, type',
  })
  orderMetadata?: {
    symbol?: string;
    side?: 'BUY' | 'SELL';
    orderType?: 'MARKET' | 'LIMIT' | 'STOP';
    estimatedAmount?: string;
  };

  @Column({
    type: 'varchar',
    length: 20,
    default: EncryptedOrderStatus.PENDING,
  })
  status: EncryptedOrderStatus;

  @Column({
    type: 'uuid',
    nullable: true,
    comment: 'Linked order ID on main order book (if matched)',
  })
  linkedOrderId?: string;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'Encrypted ZKP proof if balance verification used',
  })
  encryptedZKProof?: string;

  @Column({
    type: 'timestamp',
    nullable: true,
    comment: 'When order was matched',
  })
  matchedAt?: Date;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'Encrypted matching details',
  })
  encryptedMatchDetails?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

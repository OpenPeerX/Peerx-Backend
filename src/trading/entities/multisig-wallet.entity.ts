import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum CustodyModel {
  CENTRALIZED = 'CENTRALIZED',
  DECENTRALIZED = 'DECENTRALIZED',
  HYBRID = 'HYBRID',
}

@Entity('multisig_wallets')
@Index(['chainId'])
export class MultiSigWallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'int' })
  chainId: number;

  @Column('simple-json')
  signers: string[];

  @Column({ type: 'int' })
  threshold: number;

  @Column({
    type: 'simple-enum',
    enum: CustodyModel,
    default: CustodyModel.DECENTRALIZED,
  })
  custodyModel: CustodyModel;

  @Column('simple-json')
  supportedSignatureSchemes: string[];

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 10000 })
  hardwareRequiredAbove: number;

  @Column('simple-json', { nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

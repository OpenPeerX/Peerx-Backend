import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum ApprovalStatus {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('multisig_approvals')
@Index(['escrowId', 'signerAddress'], { unique: true })
@Index(['walletId'])
export class MultiSigApproval {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  escrowId: string;

  @Column({ type: 'uuid' })
  walletId: string;

  @Column({ type: 'varchar', length: 80 })
  signerAddress: string;

  @Column({ type: 'text' })
  signature: string;

  @Column({ type: 'varchar', length: 20 })
  signatureScheme: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  hardwareWalletFingerprint: string;

  @Column({ type: 'varchar', length: 80 })
  payloadHash: string;

  @Column({
    type: 'simple-enum',
    enum: ApprovalStatus,
    default: ApprovalStatus.APPROVED,
  })
  status: ApprovalStatus;

  @CreateDateColumn()
  approvedAt: Date;
}

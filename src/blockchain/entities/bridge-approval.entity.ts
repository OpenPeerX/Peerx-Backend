import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

/**
 * One row per signer approval of a cross-chain bridge transfer.
 *
 * The unique (bridgeId, signerId) constraint is the hard guarantee that a
 * single signer cannot approve a bridge twice — even under concurrent
 * requests — and therefore cannot reach `multisigThreshold` alone.
 */
@Entity('bridge_approvals')
@Index(['bridgeId'])
@Unique('UQ_bridge_approval_bridge_signer', ['bridgeId', 'signerId'])
export class BridgeApproval {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** FK to CrossChainBridge.id */
  @Column()
  bridgeId: string;

  /** Authenticated user id that cast this approval */
  @Column()
  signerId: string;

  @CreateDateColumn()
  createdAt: Date;
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  CrossChainBridge,
  BridgeStatus,
} from '../entities/cross-chain-bridge.entity';
import { BridgeApproval } from '../entities/bridge-approval.entity';
import { BlockchainNetwork } from '../entities/blockchain-transaction.entity';
import { BlockchainException } from '../../error/exceptions/blockchain.exception';
import { StellarService } from './stellar.service';

const BRIDGE_RESERVE_THRESHOLD = 10_000;

/** Postgres unique-violation code and SQLite constraint codes/messages. */
function isUniqueConstraintViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const code = (err as { code?: string }).code;
  if (code === '23505' || code === 'SQLITE_CONSTRAINT') return true;
  return /UNIQUE constraint failed/i.test((err as Error).message ?? '');
}

@Injectable()
export class CrossChainBridgeService {
  private readonly logger = new Logger(CrossChainBridgeService.name);
  private readonly multisigThreshold: number;
  private readonly authorizedSigners: ReadonlySet<string>;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(CrossChainBridge)
    private readonly bridgeRepo: Repository<CrossChainBridge>,
    private readonly stellarService: StellarService,
    private readonly dataSource: DataSource,
  ) {
    this.multisigThreshold = this.configService.get<number>(
      'BRIDGE_MULTISIG_THRESHOLD',
      2,
    );
    // Comma-separated list of user ids permitted to approve bridge transfers.
    // Empty by default => approvals are rejected until signers are configured.
    const raw = this.configService.get<string>('BRIDGE_SIGNER_IDS', '');
    this.authorizedSigners = new Set(
      raw
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    );
  }

  async initiateBridge(
    userId: string,
    sourceNetwork: BlockchainNetwork,
    destinationNetwork: BlockchainNetwork,
    sourceAddress: string,
    destinationAddress: string,
    amount: string,
  ): Promise<CrossChainBridge> {
    const record = this.bridgeRepo.create({
      userId,
      sourceNetwork,
      destinationNetwork,
      sourceAddress,
      destinationAddress,
      amount,
      asset: 'USDC',
      status: BridgeStatus.INITIATED,
      multisigThreshold: this.multisigThreshold,
      multisigApprovals: 0,
    });
    return this.bridgeRepo.save(record);
  }

  async addApproval(
    bridgeId: string,
    signerId: string,
  ): Promise<CrossChainBridge> {
    if (!this.authorizedSigners.has(signerId)) {
      throw BlockchainException.transactionFailed({
        reason: 'Signer is not authorized to approve this bridge',
        bridgeId,
        signerId,
      });
    }

    const outcome = await this.dataSource.transaction(async (manager) => {
      const bridge = await manager.findOne(CrossChainBridge, {
        where: { id: bridgeId },
      });
      if (!bridge) {
        throw BlockchainException.transactionFailed({
          reason: 'Bridge record not found',
          bridgeId,
        });
      }

      if (
        bridge.status !== BridgeStatus.INITIATED &&
        bridge.status !== BridgeStatus.SOURCE_CONFIRMED
      ) {
        throw BlockchainException.transactionFailed({
          reason: 'Bridge is not awaiting approvals',
          bridgeId,
        });
      }

      // Record the approval. The unique (bridgeId, signerId) constraint is the
      // hard guarantee against double-approval even under concurrent requests.
      const approvalRepo = manager.getRepository(BridgeApproval);
      try {
        await approvalRepo.save(approvalRepo.create({ bridgeId, signerId }));
      } catch (err) {
        if (isUniqueConstraintViolation(err)) {
          throw BlockchainException.transactionFailed({
            reason: 'Signer has already approved this bridge',
            bridgeId,
            signerId,
          });
        }
        throw err;
      }

      // Atomic increment — no read-modify-write, so parallel approvals can
      // never overwrite each other's counter regardless of driver locking.
      await manager
        .createQueryBuilder()
        .update(CrossChainBridge)
        .set({ multisigApprovals: () => 'multisigApprovals + 1' })
        .where('id = :id', { id: bridgeId })
        .execute();

      const updated = await manager.findOne(CrossChainBridge, {
        where: { id: bridgeId },
      });
      if (!updated) {
        throw BlockchainException.transactionFailed({
          reason: 'Bridge record not found',
          bridgeId,
        });
      }

      if (updated.multisigApprovals < updated.multisigThreshold) {
        return { bridge: updated, shouldExecute: false };
      }

      // Conditional status flip: only one concurrent transaction can move the
      // bridge out of the awaiting-approvals states, guaranteeing executeBridge
      // runs exactly once even when the threshold is crossed in parallel.
      const flip = await manager
        .createQueryBuilder()
        .update(CrossChainBridge)
        .set({ status: BridgeStatus.BRIDGE_PROCESSING })
        .where('id = :id', { id: bridgeId })
        .andWhere('status IN (:...statuses)', {
          statuses: [BridgeStatus.INITIATED, BridgeStatus.SOURCE_CONFIRMED],
        })
        .execute();

      return {
        bridge: { ...updated, status: BridgeStatus.BRIDGE_PROCESSING },
        shouldExecute: (flip.affected ?? 0) > 0,
      };
    });

    if (outcome.shouldExecute) {
      return this.executeBridge(outcome.bridge);
    }
    return outcome.bridge;
  }

  private async executeBridge(
    bridge: CrossChainBridge,
  ): Promise<CrossChainBridge> {
    try {
      bridge.status = BridgeStatus.DESTINATION_PENDING;
      await this.bridgeRepo.save(bridge);

      if (bridge.destinationNetwork === BlockchainNetwork.STELLAR) {
        const tx = await this.stellarService.withdraw(
          bridge.userId,
          bridge.destinationAddress,
          bridge.amount,
          `bridge:${bridge.id}`,
        );
        bridge.destinationTxHash = tx.txHash;
      } else {
        // Ethereum destination: log intent and mark pending (hot-wallet signer external)
        this.logger.log(
          `Bridge ${bridge.id}: ETH destination tx queued for ${bridge.destinationAddress}`,
        );
      }

      bridge.status = BridgeStatus.COMPLETED;
    } catch (err) {
      this.logger.error(`Bridge ${bridge.id} execution failed`, err);
      bridge.status = BridgeStatus.FAILED;
      bridge.errorMessage = err.message;
      await this.bridgeRepo.save(bridge);
      await this.refundBridge(bridge);
      throw BlockchainException.transactionFailed({
        bridgeId: bridge.id,
        error: err.message,
      });
    }

    return this.bridgeRepo.save(bridge);
  }

  private async refundBridge(bridge: CrossChainBridge): Promise<void> {
    try {
      if (bridge.sourceNetwork === BlockchainNetwork.STELLAR) {
        await this.stellarService.withdraw(
          bridge.userId,
          bridge.sourceAddress,
          bridge.amount,
          `refund:${bridge.id}`,
        );
      }
      bridge.status = BridgeStatus.REFUNDED;
      await this.bridgeRepo.save(bridge);
      this.logger.log(
        `Bridge ${bridge.id} refunded to ${bridge.sourceAddress}`,
      );
    } catch (err) {
      this.logger.error(`Refund failed for bridge ${bridge.id}`, err);
    }
  }

  async getBridgeHealth(): Promise<{
    healthy: boolean;
    alertMessage?: string;
  }> {
    const totalLockedResult = await this.bridgeRepo
      .createQueryBuilder('b')
      .select('COALESCE(SUM(CAST(b.amount AS DECIMAL)), 0)', 'total')
      .where('b.status IN (:...statuses)', {
        statuses: [
          BridgeStatus.INITIATED,
          BridgeStatus.SOURCE_CONFIRMED,
          BridgeStatus.BRIDGE_PROCESSING,
        ],
      })
      .getRawOne<{ total: string }>();

    const totalLocked = parseFloat(totalLockedResult?.total ?? '0');
    const healthy = totalLocked < BRIDGE_RESERVE_THRESHOLD;

    return {
      healthy,
      alertMessage: healthy
        ? undefined
        : `Bridge reserves critically low: ${totalLocked} USDC locked in pending operations`,
    };
  }

  async getBridgeById(id: string): Promise<CrossChainBridge | null> {
    return this.bridgeRepo.findOne({ where: { id } });
  }

  async getBridgeHistory(userId: string): Promise<CrossChainBridge[]> {
    return this.bridgeRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
}

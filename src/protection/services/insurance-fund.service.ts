import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { InsuranceFund } from '../entities/insurance-fund.entity';
import { InsuranceFundTier } from '../entities/insurance-fund-tier.entity';
import { InsuranceTransaction } from '../entities/insurance-transaction.entity';
import { InsuranceTxType } from '../enums/insurance-tx-type.enum';
import { FundTier } from '../enums/fund-tier.enum';
import { FundHealthStatus } from '../enums/fund-health-status.enum';
import { FundHealthService } from './fund-health.service';

export const DEFAULT_TIERS: Array<{
  tier: FundTier;
  name: string;
  minReserve: number;
  maxExposure: number;
  feeContributionPct: number;
  targetReserve: number;
}> = [
  {
    tier: FundTier.LOW,
    name: 'Low Risk Fund',
    minReserve: 10000,
    maxExposure: 50000,
    feeContributionPct: 5,
    targetReserve: 100000,
  },
  {
    tier: FundTier.MEDIUM,
    name: 'Medium Risk Fund',
    minReserve: 25000,
    maxExposure: 150000,
    feeContributionPct: 10,
    targetReserve: 250000,
  },
  {
    tier: FundTier.HIGH,
    name: 'High Risk Fund',
    minReserve: 50000,
    maxExposure: 500000,
    feeContributionPct: 15,
    targetReserve: 500000,
  },
  {
    tier: FundTier.CRITICAL,
    name: 'Critical Risk Fund',
    minReserve: 100000,
    maxExposure: 1000000,
    feeContributionPct: 20,
    targetReserve: 1000000,
  },
];

export interface InsuranceTransactionOptions {
  referenceId?: string;
  userId?: number;
  description?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class InsuranceFundService {
  constructor(
    @InjectRepository(InsuranceFund)
    private readonly fundRepo: Repository<InsuranceFund>,
    @InjectRepository(InsuranceFundTier)
    private readonly tierRepo: Repository<InsuranceFundTier>,
    @InjectRepository(InsuranceTransaction)
    private readonly txRepo: Repository<InsuranceTransaction>,
    private readonly fundHealthService: FundHealthService,
  ) {}

  async initializeFunds(asset = 'USDT'): Promise<InsuranceFund[]> {
    const funds: InsuranceFund[] = [];

    for (const config of DEFAULT_TIERS) {
      let tier = await this.tierRepo.findOne({ where: { tier: config.tier } });
      if (!tier) {
        tier = await this.tierRepo.save(
          this.tierRepo.create({
            tier: config.tier,
            name: config.name,
            minReserve: config.minReserve,
            maxExposure: config.maxExposure,
            feeContributionPct: config.feeContributionPct,
          }),
        );
      }

      let fund = await this.fundRepo.findOne({
        where: { tierId: tier.id, asset },
      });
      if (!fund) {
        fund = await this.fundRepo.save(
          this.fundRepo.create({
            tierId: tier.id,
            asset,
            balance: config.targetReserve * 0.5,
            targetReserve: config.targetReserve,
            healthStatus: FundHealthStatus.HEALTHY,
            healthPercent: 50,
          }),
        );
      }
      await this.fundHealthService.updateFundHealth(fund.id);
      funds.push(fund);
    }

    return funds;
  }

  /**
   * Load a fund. Pass a transaction `manager` to read inside an open
   * transaction (used by multi-tier coverage in LiquidationProtectionService).
   */
  async getFund(
    fundId: number,
    manager?: EntityManager,
  ): Promise<InsuranceFund> {
    const fundRepo = manager
      ? manager.getRepository(InsuranceFund)
      : this.fundRepo;
    const fund = await fundRepo.findOne({
      where: { id: fundId },
      relations: ['tier'],
    });
    if (!fund) {
      throw new NotFoundException(`Insurance fund ${fundId} not found`);
    }
    return fund;
  }

  async getFundsByTier(tier: FundTier, asset = 'USDT'): Promise<InsuranceFund> {
    const tierEntity = await this.tierRepo.findOne({ where: { tier } });
    if (!tierEntity) {
      throw new NotFoundException(`Fund tier ${tier} not found`);
    }
    const fund = await this.fundRepo.findOne({
      where: { tierId: tierEntity.id, asset },
      relations: ['tier'],
    });
    if (!fund) {
      throw new NotFoundException(
        `Fund for tier ${tier} and asset ${asset} not found`,
      );
    }
    return fund;
  }

  async listFunds(): Promise<InsuranceFund[]> {
    return this.fundRepo.find({
      relations: ['tier'],
      order: { tierId: 'ASC' },
    });
  }

  async listTiers(): Promise<InsuranceFundTier[]> {
    return this.tierRepo.find({ order: { id: 'ASC' } });
  }

  /**
   * Record a balance-changing transaction.
   *
   * The balance mutation is a single conditional UPDATE (`balance = balance -/+
   * :amount`), never a read-modify-write in application memory, so concurrent
   * payouts can never spend the same balance twice: the payout guard
   * `balance >= amount` is evaluated by the database while holding the row
   * lock, and an unapplied update means the caller lost the race.
   *
   * Pass a transaction `manager` when this call participates in an outer
   * transaction (see LiquidationProtectionService.coverShortfall). Without
   * one, the debit, the audit row and the health refresh run in a transaction
   * of their own.
   */
  async recordTransaction(
    fundId: number,
    type: InsuranceTxType,
    amount: number,
    options: InsuranceTransactionOptions = {},
    manager?: EntityManager,
  ): Promise<{ fund: InsuranceFund; transaction: InsuranceTransaction }> {
    if (manager) {
      return this.executeRecordTransaction(
        manager,
        fundId,
        type,
        amount,
        options,
      );
    }

    const result = await this.fundRepo.manager.transaction((m) =>
      this.executeRecordTransaction(m, fundId, type, amount, options),
    );

    // Health is refreshed after commit so the recalculation reads the
    // committed balance rather than the pre-transaction snapshot.
    await this.fundHealthService.updateFundHealth(fundId);

    return result;
  }

  private async executeRecordTransaction(
    manager: EntityManager,
    fundId: number,
    type: InsuranceTxType,
    amount: number,
    options: InsuranceTransactionOptions = {},
  ): Promise<{ fund: InsuranceFund; transaction: InsuranceTransaction }> {
    const fundRepo = manager.getRepository(InsuranceFund);
    const txRepo = manager.getRepository(InsuranceTransaction);

    if (type === InsuranceTxType.PAYOUT) {
      const debited = await this.debitBalance(fundRepo, fundId, amount);
      if (!debited) {
        throw new BadRequestException('Insufficient fund balance for payout');
      }
    } else {
      await this.creditBalance(fundRepo, fundId, amount);
    }

    const fund = await fundRepo.findOne({
      where: { id: fundId },
      relations: ['tier'],
    });
    if (!fund) {
      throw new NotFoundException(`Insurance fund ${fundId} not found`);
    }

    const balanceAfter = Number(fund.balance);
    const balanceBefore =
      type === InsuranceTxType.PAYOUT
        ? balanceAfter + amount
        : balanceAfter - amount;

    const transaction = await txRepo.save(
      txRepo.create({
        fundId,
        type,
        amount,
        balanceBefore,
        balanceAfter,
        referenceId: options.referenceId,
        userId: options.userId,
        description: options.description,
        metadata: options.metadata,
      }),
    );

    return { fund, transaction };
  }

  /**
   * Atomic conditional debit: `UPDATE insurance_fund SET balance = balance -
   * :amount WHERE id = :id AND balance >= :amount`. Returns whether a row was
   * updated — a false result means the balance is insufficient (either from
   * the start or because a concurrent payout drained the fund first).
   */
  private async debitBalance(
    fundRepo: Repository<InsuranceFund>,
    fundId: number,
    amount: number,
  ): Promise<boolean> {
    const debit = Number(amount);
    const result = await fundRepo
      .createQueryBuilder()
      .update(InsuranceFund)
      .set({ balance: () => `"balance" - ${debit}` })
      .where('id = :id AND balance >= :amount', { id: fundId, amount: debit })
      .execute();
    return (result.affected ?? 0) > 0;
  }

  /** Atomic unconditional credit (replenishments and fee contributions). */
  private async creditBalance(
    fundRepo: Repository<InsuranceFund>,
    fundId: number,
    amount: number,
  ): Promise<void> {
    const credit = Number(amount);
    await fundRepo
      .createQueryBuilder()
      .update(InsuranceFund)
      .set({ balance: () => `"balance" + ${credit}` })
      .where('id = :id', { id: fundId })
      .execute();
  }

  async replenishFund(
    fundId: number,
    amount: number,
    referenceId?: string,
    description?: string,
  ) {
    return this.recordTransaction(
      fundId,
      InsuranceTxType.REPLENISHMENT,
      amount,
      {
        referenceId,
        description: description ?? 'Manual fund replenishment',
      },
    );
  }

  async contributeFromFees(fundId: number, amount: number, tradeId: string) {
    return this.recordTransaction(
      fundId,
      InsuranceTxType.FEE_CONTRIBUTION,
      amount,
      {
        referenceId: tradeId,
        description: `Trading fee contribution from trade ${tradeId}`,
        metadata: { source: 'trading_fees' },
      },
    );
  }

  async getTransactionHistory(
    fundId?: number,
    limit = 50,
  ): Promise<InsuranceTransaction[]> {
    const where = fundId ? { fundId } : {};
    return this.txRepo.find({
      where,
      relations: ['fund', 'fund.tier'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}

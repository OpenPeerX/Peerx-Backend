import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InsuranceFundService } from './insurance-fund.service';
import { FundHealthService } from './fund-health.service';
import { LiquidationEvent } from '../entities/liquidation-event.entity';
import { FundTier } from '../enums/fund-tier.enum';
import { InsuranceTxType } from '../enums/insurance-tx-type.enum';
import {
  InsurancePayoutEvent,
  LiquidationShortfallEvent,
} from '../../infrastructure/events/domain.events';

export interface CoverShortfallResult {
  liquidationEvent: LiquidationEvent;
  coveredAmount: number;
  remainingShortfall: number;
  cascadePrevented: boolean;
  fundsUsed: Array<{ fundId: number; amount: number; tier: string }>;
}

const TIER_PRIORITY: FundTier[] = [
  FundTier.LOW,
  FundTier.MEDIUM,
  FundTier.HIGH,
  FundTier.CRITICAL,
];

/**
 * Number of debit attempts per tier before moving on. One retry after a
 * re-read of the committed balance absorbs the race where a concurrent
 * payout drains a fund between the advisory read and the debit.
 */
const MAX_DEBIT_ATTEMPTS_PER_TIER = 2;

@Injectable()
export class LiquidationProtectionService {
  constructor(
    @InjectRepository(LiquidationEvent)
    private readonly liquidationRepo: Repository<LiquidationEvent>,
    private readonly insuranceFundService: InsuranceFundService,
    private readonly fundHealthService: FundHealthService,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Cover a liquidation shortfall from the insurance funds.
   *
   * The whole multi-tier walk runs inside one `DataSource` transaction:
   *   - every payout is an atomic conditional UPDATE (see
   *     InsuranceFundService.recordTransaction), so concurrent liquidations
   *     serialize on the fund row locks instead of double-spending a balance;
   *   - tiers are always visited in the fixed TIER_PRIORITY order, so any two
   *     concurrent liquidations acquire row locks in the same order and can
   *     never deadlock;
   *   - the liquidation event row is committed together with the debits.
   *
   * Health recalculation and domain events run only after commit, so they
   * observe the durable balances and never fire for a rolled-back transaction.
   *
   * Partial coverage is an explicit outcome, never a swallowed error: when no
   * tier has enough balance left, the LiquidationEvent is recorded with
   * status PARTIAL and `cascadePrevented: false`, and a LiquidationShortfallEvent
   * is emitted with `cascadePrevented: false`.
   */
  async coverShortfall(
    userId: number,
    shortfallAmount: number,
    positionId?: string,
    asset = 'USDT',
    preferredTier?: FundTier,
  ): Promise<CoverShortfallResult> {
    if (shortfallAmount <= 0) {
      throw new Error('Shortfall amount must be positive');
    }

    const tiersToTry = preferredTier
      ? [preferredTier, ...TIER_PRIORITY.filter((t) => t !== preferredTier)]
      : TIER_PRIORITY;

    // Advisory fund reads happen BEFORE the transaction. Their balances are
    // only a starting point — every payout inside the transaction is a guarded
    // UPDATE that re-checks the committed balance, and a lost race is retried
    // with a fresh read. Reading before the transaction (rather than inside
    // it) also keeps the transaction write-only on backends whose single
    // connection cannot hold a read lock and then wait on a writer
    // (SQLite), mirroring what Postgres' MVCC does anyway.
    const fundsByTier = new Map<
      FundTier,
      Awaited<ReturnType<InsuranceFundService['getFundsByTier']>>
    >();
    for (const tier of tiersToTry) {
      try {
        fundsByTier.set(
          tier,
          await this.insuranceFundService.getFundsByTier(tier, asset),
        );
      } catch (err) {
        // A tier with no initialized fund is skipped — that is normal
        // control flow. Anything else aborts before any debit is made
        // rather than being silently swallowed.
        if (err instanceof NotFoundException) continue;
        throw err;
      }
    }

    const outcome = await this.dataSource.transaction(async (manager) => {
      let remaining = shortfallAmount;
      const fundsUsed: Array<{ fundId: number; amount: number; tier: string }> =
        [];
      let primaryFundId: number | undefined = undefined;

      for (const tier of tiersToTry) {
        if (remaining <= 0) break;

        const fund = fundsByTier.get(tier);
        if (!fund || Number(fund.balance) <= 0) continue;

        let coverAmount = Math.min(Number(fund.balance), remaining);
        let record: Awaited<
          ReturnType<InsuranceFundService['recordTransaction']>
        > | null = null;

        for (
          let attempt = 0;
          attempt < MAX_DEBIT_ATTEMPTS_PER_TIER && !record;
          attempt++
        ) {
          try {
            record = await this.insuranceFundService.recordTransaction(
              fund.id,
              InsuranceTxType.PAYOUT,
              coverAmount,
              {
                userId,
                referenceId: positionId,
                description: `Liquidation shortfall coverage for user ${userId}`,
                metadata: { positionId, tier, shortfallAmount },
              },
              manager,
            );
          } catch (err) {
            if (!(err instanceof BadRequestException)) throw err;
            if (attempt > 0) break;
            // Lost the race: re-read the committed balance inside this
            // transaction and retry once with the fresh amount. This read is
            // safe — it follows the failed guarded UPDATE, which already
            // acquired the write lock.
            const fresh = await this.insuranceFundService.getFund(
              fund.id,
              manager,
            );
            const available = Number(fresh.balance);
            if (available <= 0) break;
            coverAmount = Math.min(available, remaining);
          }
        }

        if (!record) continue;

        fundsUsed.push({ fundId: fund.id, amount: coverAmount, tier });
        if (!primaryFundId) primaryFundId = fund.id;
        remaining -= coverAmount;
      }

      const coveredAmount = shortfallAmount - remaining;
      const cascadePrevented = remaining <= 0;

      const liquidationEvent = await manager.save(
        LiquidationEvent,
        manager.create(LiquidationEvent, {
          userId,
          positionId,
          shortfallAmount,
          coveredAmount,
          fundId: primaryFundId,
          cascadePrevented,
          status: cascadePrevented ? 'COVERED' : 'PARTIAL',
          notes: cascadePrevented
            ? 'Full shortfall covered by insurance fund'
            : `Partial coverage: ${remaining} remaining shortfall`,
        }),
      );

      return {
        liquidationEvent,
        coveredAmount,
        remainingShortfall: remaining,
        cascadePrevented,
        fundsUsed,
      };
    });

    // Post-commit work only. FundHealthService reads through its own
    // repository (a separate connection) and would see stale, uncommitted
    // balances inside the transaction.
    for (const used of outcome.fundsUsed) {
      await this.fundHealthService.updateFundHealth(used.fundId);
    }

    this.eventEmitter.emit(
      'liquidation.shortfall',
      new LiquidationShortfallEvent(
        outcome.liquidationEvent.id,
        userId,
        shortfallAmount,
        outcome.coveredAmount,
        outcome.cascadePrevented,
      ),
    );

    if (outcome.coveredAmount > 0) {
      this.eventEmitter.emit(
        'insurance.payout',
        new InsurancePayoutEvent(
          outcome.liquidationEvent.id,
          userId,
          outcome.coveredAmount,
          outcome.fundsUsed,
        ),
      );
    }

    return outcome;
  }
}

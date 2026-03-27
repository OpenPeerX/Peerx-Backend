import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Referral, ReferralStatus } from './entities/referral.entity';
import { User } from '../user/entities/user.entity';
import { UserBalance } from '../balance/entities/user-balance.entity';
import { BalanceAudit } from 'src/balance/balance-audit.entity';
import { Trade } from 'src/trading/entities/trade.entity';

// ─── Config ────────────────────────────────────────────────────────────────────
const REWARD_CONFIG = {
  referrerBonus: 10, // USD credited to referrer
  refereeBonus: 5, // USD credited to referee
  auditSource: 'REFERRAL_REWARD',
};

// ─── DTOs ──────────────────────────────────────────────────────────────────────
export interface LeaderboardEntry {
  rank: number;
  userId: number;
  displayName: string; // anonymized: "User #1234"
  count: number; // referrals or trade volume
  reward?: number;
}

export interface LeaderboardResult {
  period: 'weekly' | 'monthly' | 'all-time';
  entries: LeaderboardEntry[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export type TradingMetric = 'volume' | 'profit' | 'count';

// ─── Service ───────────────────────────────────────────────────────────────────
@Injectable()
export class ReferralServiceExtended {
  private readonly logger = new Logger(ReferralServiceExtended.name);

  constructor(
    private dataSource: DataSource,
    @InjectRepository(Referral) private referralRepo: Repository<Referral>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(UserBalance) private balanceRepo: Repository<UserBalance>,
    @InjectRepository(BalanceAudit) private auditRepo: Repository<BalanceAudit>,
    @InjectRepository(Trade) private tradeRepo: Repository<Trade>,
  ) {}

  // ── 1. TRACKING: Resolve referral code from session on registration ──────────

  /**
   * Call this inside AuthService.register() after user is created.
   * Reads referral code from session, validates, and creates the referral link.
   */
  async handleRegistrationReferral(
    newUserId: number,
    session: Record<string, any>,
  ): Promise<void> {
    const code = session?.[REFERRAL_SESSION_KEY];
    if (!code) return;

    const validation = await this.validateReferralCode(code);
    if (!validation.valid || !validation.referrerId) {
      this.logger.warn(
        `Invalid/expired referral code used during registration: ${code}`,
      );
      return;
    }

    // Prevent self-referral
    if (validation.referrerId === newUserId) {
      this.logger.warn(`Self-referral attempt blocked for user ${newUserId}`);
      return;
    }

    // Prevent duplicate referral for same user
    const exists = await this.referralRepo.findOne({
      where: { referredUserId: newUserId },
    });
    if (exists) return;

    const referredUser = await this.userRepo.findOneOrFail({
      where: { id: newUserId },
    });

    const referral = this.referralRepo.create({
      referrerId: validation.referrerId,
      referredUserId: newUserId,
      referralCode: code,
      referredUserEmail: referredUser.email,
      referredUserUsername: referredUser.username,
      status: ReferralStatus.PENDING,
      referredAt: new Date(),
      pendingReward: REWARD_CONFIG.referrerBonus,
      earnedReward: 0,
    });

    await this.referralRepo.save(referral);
    this.logger.log(
      `Referral tracked: ${validation.referrerId} → ${newUserId}`,
    );

    // Clear session so it can't be reused
    delete session[REFERRAL_SESSION_KEY];
  }

  // ── 2. REWARD DISTRIBUTION: Trigger on KYC/verification complete ─────────────

  /**
   * Call this from KYC/verification service when a user is verified.
   * Credits referrer + referee balances atomically.
   */
  async distributeReferralReward(verifiedUserId: number): Promise<void> {
    const referral = await this.referralRepo.findOne({
      where: { referredUserId: verifiedUserId, status: ReferralStatus.PENDING },
    });

    if (!referral) return; // No pending referral — nothing to do

    await this.dataSource.transaction(async (manager) => {
      const now = new Date();

      // Credit referrer
      await this.creditBalance(
        manager,
        referral.referrerId,
        REWARD_CONFIG.referrerBonus,
        `Referral bonus for referring user #${verifiedUserId}`,
      );

      // Credit referee
      await this.creditBalance(
        manager,
        verifiedUserId,
        REWARD_CONFIG.refereeBonus,
        `Welcome bonus from referral signup`,
      );

      // Mark referral completed
      await manager.update(Referral, referral.id, {
        status: ReferralStatus.COMPLETED,
        earnedReward: REWARD_CONFIG.referrerBonus,
        pendingReward: 0,
        rewardedAt: now,
      });
    });

    this.logger.log(
      `Rewards distributed — referrer ${referral.referrerId}: $${REWARD_CONFIG.referrerBonus}, ` +
        `referee ${verifiedUserId}: $${REWARD_CONFIG.refereeBonus}`,
    );
  }

  /** Credits balance and writes audit row inside a given transaction */
  private async creditBalance(
    manager: any,
    userId: number,
    amount: number,
    note: string,
  ): Promise<void> {
    let balance = await manager.findOne(UserBalance, { where: { userId } });

    if (!balance) {
      balance = manager.create(UserBalance, { userId, balance: 0 });
    }

    balance.balance = Number(balance.balance) + amount;
    await manager.save(UserBalance, balance);

    const audit = manager.create(BalanceAudit, {
      userId,
      amount,
      source: REWARD_CONFIG.auditSource,
      note,
      createdAt: new Date(),
    });
    await manager.save(BalanceAudit, audit);
  }

  // ── 3. REFERRAL LEADERBOARD ─────────────────────────────────────────────────

  /**
   * Returns users ranked by number of completed referrals.
   * Supports weekly / monthly / all-time periods with pagination.
   */
  async getReferralLeaderboard(
    period: 'weekly' | 'monthly' | 'all-time',
    page = 1,
    pageSize = 20,
  ): Promise<LeaderboardResult> {
    const since = this.periodToDate(period);
    const offset = (page - 1) * pageSize;

    const qb = this.referralRepo
      .createQueryBuilder('r')
      .select('r.referrerId', 'userId')
      .addSelect('COUNT(r.id)', 'count')
      .addSelect('SUM(r.earnedReward)', 'reward')
      .where('r.status = :status', { status: ReferralStatus.COMPLETED })
      .groupBy('r.referrerId')
      .orderBy('count', 'DESC')
      .limit(pageSize)
      .offset(offset);

    if (since) {
      qb.andWhere('r.rewardedAt >= :since', { since });
    }

    const [rows, total] = await Promise.all([qb.getRawMany(), qb.getCount()]);

    const entries: LeaderboardEntry[] = rows.map((row, i) => ({
      rank: offset + i + 1,
      userId: row.userId,
      displayName: `User #${String(row.userId).padStart(4, '0')}`, // anonymized
      count: Number(row.count),
      reward: Number(row.reward ?? 0),
    }));

    return {
      period,
      entries,
      total,
      page,
      pageSize,
      hasMore: offset + entries.length < total,
    };
  }

  // ── 4. TRADING LEADERBOARD ──────────────────────────────────────────────────

  /**
   * Returns users ranked by trading performance.
   * metric: 'volume' (sum of amount*price), 'profit' (sell - buy), 'count' (# trades)
   */
  async getTradingLeaderboard(
    period: 'daily' | 'weekly' | 'monthly',
    metric: TradingMetric = 'volume',
    page = 1,
    pageSize = 20,
  ): Promise<LeaderboardResult & { metric: TradingMetric }> {
    const since = this.periodToDate(period === 'daily' ? 'weekly' : period); // reuse helper
    const offset = (page - 1) * pageSize;

    // Build metric-specific query
    // Trade entity: { id, buyerId, sellerId, amount, price, createdAt }
    let qb: any;

    if (metric === 'volume') {
      // Total traded value (buyer side to avoid double-counting)
      qb = this.tradeRepo
        .createQueryBuilder('t')
        .select('t.buyerId', 'userId')
        .addSelect('SUM(t.amount * t.price)', 'count')
        .where('t.createdAt >= :since', { since: since ?? new Date(0) })
        .groupBy('t.buyerId')
        .orderBy('count', 'DESC');
    } else if (metric === 'count') {
      // Trades as buyer OR seller — union via subquery
      qb = this.tradeRepo
        .createQueryBuilder('t')
        .select('t.buyerId', 'userId')
        .addSelect('COUNT(*)', 'count')
        .where('t.createdAt >= :since', { since: since ?? new Date(0) })
        .groupBy('t.buyerId')
        .orderBy('count', 'DESC');
    } else {
      // profit: sum of sell proceeds minus buy costs
      qb = this.tradeRepo
        .createQueryBuilder('t')
        .select('t.buyerId', 'userId')
        .addSelect(
          'SUM(CASE WHEN t.sellerId = t.buyerId THEN 0 ELSE -(t.amount * t.price) END)',
          'count',
        )
        .where('t.createdAt >= :since', { since: since ?? new Date(0) })
        // Exclude potential wash trades (buyer = seller)
        .andWhere('t.buyerId != t.sellerId')
        .groupBy('t.buyerId')
        .orderBy('count', 'DESC');
    }

    qb.limit(pageSize).offset(offset);

    const [rows, total] = await Promise.all([qb.getRawMany(), qb.getCount()]);

    const entries: LeaderboardEntry[] = rows.map((row, i) => ({
      rank: offset + i + 1,
      userId: row.userId,
      displayName: `Trader #${String(row.userId).padStart(4, '0')}`, // anonymized
      count: Number(Number(row.count).toFixed(2)),
    }));

    return {
      period: period as any,
      metric,
      entries,
      total,
      page,
      pageSize,
      hasMore: offset + entries.length < total,
    };
  }

  // ── Shared helpers ───────────────────────────────────────────────────────────

  private periodToDate(period: string): Date | null {
    const now = new Date();
    if (period === 'weekly') {
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
    if (period === 'monthly') {
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }
    if (period === 'daily') {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    return null; // all-time
  }

  private async validateReferralCode(
    code: string,
  ): Promise<{ valid: boolean; referrerId?: number }> {
    const referral = await this.referralRepo.findOne({
      where: { referralCode: code },
    });
    if (!referral) return { valid: false };
    return { valid: true, referrerId: referral.referrerId };
  }
}

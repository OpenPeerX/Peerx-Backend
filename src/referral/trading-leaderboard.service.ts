import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Trade } from 'src/trading/entities/trade.entity';

// ─── Types ─────────────────────────────────────────────────────────────────
type Period = 'daily' | 'weekly' | 'monthly';
type Metric = 'volume' | 'pnl' | 'count';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  value: string; // stringified decimal for precision
}

const CACHE_TTL = 300; // 5 minutes

function periodStart(period: Period): Date {
  const d = new Date();
  if (period === 'daily') d.setHours(0, 0, 0, 0);
  if (period === 'weekly') d.setDate(d.getDate() - 7);
  if (period === 'monthly') d.setMonth(d.getMonth() - 1);
  return d;
}

function anonymize(userId: string): string {
  return userId.slice(0, 4) + '****';
}

// ─── Service ───────────────────────────────────────────────────────────────
@Injectable()
export class TradingLeaderboardService {
  constructor(
    @InjectRepository(Trade)
    private readonly tradeRepo: Repository<Trade>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async getLeaderboard(
    period: Period,
    metric: Metric,
    page = 1,
    limit = 20,
  ): Promise<LeaderboardEntry[]> {
    const cacheKey = `lb:trading:${period}:${metric}:${page}:${limit}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const since = periodStart(period);
    const result = await this._query(metric, since, page, limit);
    await this.redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
    return result;
  }

  // ─── Query builders per metric ──────────────────────────────────────────
  private async _query(
    metric: Metric,
    since: Date,
    page: number,
    limit: number,
  ): Promise<LeaderboardEntry[]> {
    const offset = (page - 1) * limit;

    if (metric === 'volume') return this._volumeQuery(since, offset, limit);
    if (metric === 'pnl') return this._pnlQuery(since, offset, limit);
    return this._countQuery(since, offset, limit);
  }

  private async _volumeQuery(since: Date, offset: number, limit: number) {
    // Total traded amount (buyer side) per user, excluding wash trades
    // (wash trade = same user is both buyer and seller on matching trades)
    const rows = await this.tradeRepo
      .createQueryBuilder('t')
      .select('t.buyerId', 'userId')
      .addSelect('SUM(t.amount * t.price)', 'value')
      .where('t.createdAt >= :since', { since })
      .andWhere('t.buyerId != t.sellerId') // exclude wash trades
      .groupBy('t.buyerId')
      .orderBy('value', 'DESC')
      .offset(offset)
      .limit(limit)
      .getRawMany<{ userId: string; value: string }>();

    return rows.map((r, i) => ({
      rank: offset + i + 1,
      userId: anonymize(r.userId),
      value: parseFloat(r.value).toFixed(2),
    }));
  }

  private async _pnlQuery(since: Date, offset: number, limit: number) {
    // Simplified P&L: sum(sell proceeds) - sum(buy costs) per user
    const rows = (await this.tradeRepo.manager.query(
      `
      SELECT
        u AS "userId",
        ROUND(CAST(SUM(side_value) AS NUMERIC), 2)::TEXT AS value
      FROM (
        SELECT seller_id AS u,  SUM(amount * price) AS side_value FROM trades
        WHERE created_at >= $1 AND buyer_id != seller_id GROUP BY seller_id
        UNION ALL
        SELECT buyer_id  AS u, -SUM(amount * price) AS side_value FROM trades
        WHERE created_at >= $1 AND buyer_id != seller_id GROUP BY buyer_id
      ) sub
      GROUP BY u
      ORDER BY value DESC
      OFFSET $2 LIMIT $3
      `,
      [since, offset, limit],
    )) as { userId: string; value: string }[];

    return rows.map((r, i) => ({
      rank: offset + i + 1,
      userId: anonymize(r.userId),
      value: r.value,
    }));
  }

  private async _countQuery(since: Date, offset: number, limit: number) {
    // Trade count (as buyer OR seller combined, deduplicated)
    const rows = (await this.tradeRepo.manager.query(
      `
      SELECT u AS "userId", COUNT(*) AS value
      FROM (
        SELECT buyer_id  AS u FROM trades WHERE created_at >= $1 AND buyer_id  != seller_id
        UNION ALL
        SELECT seller_id AS u FROM trades WHERE created_at >= $1 AND buyer_id  != seller_id
      ) sub
      GROUP BY u
      ORDER BY value DESC
      OFFSET $2 LIMIT $3
      `,
      [since, offset, limit],
    )) as { userId: string; value: string }[];

    return rows.map((r, i) => ({
      rank: offset + i + 1,
      userId: anonymize(r.userId),
      value: r.value,
    }));
  }
}

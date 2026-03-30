import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { Trade } from '../trading/entities/trade.entity';
import { SocialTraderProfile } from './entities/social-trader-profile.entity';
import { SharedStrategy } from './entities/shared-strategy.entity';
import { TraderFollow } from './entities/trader-follow.entity';
import { CopyTradingRelationship } from './entities/copy-trading-relationship.entity';
import { CopiedTrade, CopiedTradeStatus } from './entities/copied-trade.entity';
import { StrategyComment } from './entities/strategy-comment.entity';
import { StrategyLike } from './entities/strategy-like.entity';
import { TraderRevenueShare } from './entities/trader-revenue-share.entity';
import { UpsertTraderProfileDto } from './dto/upsert-trader-profile.dto';
import { CreateSharedStrategyDto } from './dto/create-shared-strategy.dto';
import { FollowTraderDto } from './dto/follow-trader.dto';
import { ConfigureCopyTradingDto } from './dto/configure-copy-trading.dto';
import { AddStrategyCommentDto } from './dto/add-strategy-comment.dto';
import {
  LeaderboardEntry,
  TradeExecutionEvent,
  TraderPerformanceSnapshot,
} from './interfaces/social-trading.interfaces';

const SCORE_WEIGHT = {
  BALANCED: { roi: 0.35, winRate: 0.2, volume: 0.15, followers: 0.15, copied: 0.15 },
  RETURNS: { roi: 0.5, winRate: 0.15, volume: 0.15, followers: 0.1, copied: 0.1 },
  CONSISTENCY: { roi: 0.2, winRate: 0.35, volume: 0.1, followers: 0.15, copied: 0.2 },
} as const;

@Injectable()
export class SocialTradingService {
  private readonly logger = new Logger(SocialTradingService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Trade)
    private readonly tradeRepository: Repository<Trade>,
    @InjectRepository(SocialTraderProfile)
    private readonly profileRepository: Repository<SocialTraderProfile>,
    @InjectRepository(SharedStrategy)
    private readonly strategyRepository: Repository<SharedStrategy>,
    @InjectRepository(TraderFollow)
    private readonly followRepository: Repository<TraderFollow>,
    @InjectRepository(CopyTradingRelationship)
    private readonly copyRelationshipRepository: Repository<CopyTradingRelationship>,
    @InjectRepository(CopiedTrade)
    private readonly copiedTradeRepository: Repository<CopiedTrade>,
    @InjectRepository(StrategyComment)
    private readonly commentRepository: Repository<StrategyComment>,
    @InjectRepository(StrategyLike)
    private readonly likeRepository: Repository<StrategyLike>,
    @InjectRepository(TraderRevenueShare)
    private readonly revenueShareRepository: Repository<TraderRevenueShare>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async upsertTraderProfile(userId: number, dto: UpsertTraderProfileDto) {
    const user = await this.ensureUserExists(userId);
    const profile =
      (await this.profileRepository.findOne({ where: { userId } })) ??
      this.profileRepository.create({
        userId,
        displayName: dto.displayName ?? user.username,
      });

    profile.displayName = dto.displayName ?? profile.displayName ?? user.username;
    profile.biography = dto.biography ?? profile.biography ?? null;
    profile.specialty = dto.specialty ?? profile.specialty ?? null;
    profile.riskAppetite = dto.riskAppetite ?? profile.riskAppetite ?? 'BALANCED';
    profile.experienceLevel = dto.experienceLevel ?? profile.experienceLevel ?? 'INTERMEDIATE';
    profile.isPublic = dto.isPublic ?? profile.isPublic ?? true;

    await this.profileRepository.save(profile);
    await this.refreshProfileSummary(userId);
    return this.getTraderProfile(userId);
  }

  async getTraderProfile(userId: number) {
    const user = await this.ensureUserExists(userId);
    const profile = await this.ensureProfile(userId, user.username);
    const [strategies, analytics, followingCount] = await Promise.all([
      this.getTraderStrategies(userId),
      this.getPerformanceAnalytics(userId),
      this.followRepository.count({ where: { followerId: userId } }),
    ]);

    return {
      traderId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      profile,
      analytics,
      social: {
        followers: profile.totalFollowers,
        following: followingCount,
        totalStrategies: profile.totalStrategies,
        totalLikes: profile.totalLikes,
        copiedAssetsUnderManagement: this.toNumber(profile.copiedAssetsUnderManagement),
        revenueShareEarned: this.toNumber(profile.revenueShareEarned),
      },
      strategies,
    };
  }

  async createSharedStrategy(dto: CreateSharedStrategyDto) {
    await this.ensureUserExists(dto.traderId);
    await this.ensureProfile(dto.traderId);

    const strategy = this.strategyRepository.create({
      traderId: dto.traderId,
      title: dto.title,
      description: dto.description,
      asset: dto.asset,
      marketType: dto.marketType ?? 'SPOT',
      riskLevel: dto.riskLevel ?? 'BALANCED',
      minimumCapital: dto.minimumCapital ?? 0,
      allocationPercentage: dto.allocationPercentage ?? 25,
      stopLossPercentage: dto.stopLossPercentage ?? 8,
      takeProfitPercentage: dto.takeProfitPercentage ?? 15,
      tags: dto.tags ?? null,
      metadata: {
        acceptanceCoverage: [
          'strategy-sharing',
          'customizable-risk',
          'performance-reporting',
        ],
      },
    });

    const saved = await this.strategyRepository.save(strategy);
    await this.refreshProfileSummary(dto.traderId);
    return this.getStrategy(saved.id);
  }

  async getStrategy(strategyId: number) {
    const strategy = await this.strategyRepository.findOne({ where: { id: strategyId } });
    if (!strategy) {
      throw new NotFoundException(`Strategy ${strategyId} not found`);
    }

    const [comments, likes, analytics] = await Promise.all([
      this.commentRepository.find({
        where: { strategyId },
        order: { createdAt: 'DESC' },
      }),
      this.likeRepository.count({ where: { strategyId } }),
      this.getStrategyAnalytics(strategy),
    ]);

    return {
      ...strategy,
      likes,
      comments,
      analytics,
    };
  }

  async getTraderStrategies(traderId: number) {
    const strategies = await this.strategyRepository.find({
      where: { traderId },
      order: { createdAt: 'DESC' },
    });

    if (strategies.length === 0) {
      return [];
    }

    const strategyIds = strategies.map((strategy) => strategy.id);
    const [comments, likes] = await Promise.all([
      this.commentRepository.find({ where: { strategyId: In(strategyIds) } }),
      this.likeRepository.find({ where: { strategyId: In(strategyIds) } }),
    ]);

    return strategies.map((strategy) => ({
      ...strategy,
      commentCount: comments.filter((comment) => comment.strategyId === strategy.id).length,
      likeCount: likes.filter((like) => like.strategyId === strategy.id).length,
    }));
  }

  async followTrader(dto: FollowTraderDto) {
    await this.ensureDistinctUsers(dto.followerId, dto.traderId, 'follow');
    await Promise.all([
      this.ensureUserExists(dto.followerId),
      this.ensureUserExists(dto.traderId),
    ]);

    const existing = await this.followRepository.findOne({
      where: { followerId: dto.followerId, traderId: dto.traderId },
    });
    if (existing) {
      return existing;
    }

    const saved = await this.followRepository.save(
      this.followRepository.create({
        followerId: dto.followerId,
        traderId: dto.traderId,
      }),
    );
    await this.refreshProfileSummary(dto.traderId);
    return saved;
  }

  async configureCopyTrading(dto: ConfigureCopyTradingDto) {
    await this.ensureDistinctUsers(dto.followerId, dto.traderId, 'copy');
    await Promise.all([
      this.ensureUserExists(dto.followerId),
      this.ensureUserExists(dto.traderId),
    ]);

    if (dto.strategyId) {
      const strategy = await this.strategyRepository.findOne({ where: { id: dto.strategyId } });
      if (!strategy || strategy.traderId !== dto.traderId) {
        throw new BadRequestException('Strategy does not belong to the selected trader');
      }
    }

    const relationship =
      (await this.copyRelationshipRepository.findOne({
        where: { followerId: dto.followerId, traderId: dto.traderId },
      })) ??
      this.copyRelationshipRepository.create({
        followerId: dto.followerId,
        traderId: dto.traderId,
      });

    relationship.strategyId = dto.strategyId ?? null;
    relationship.maxAllocationPercentage = dto.maxAllocationPercentage ?? relationship.maxAllocationPercentage ?? 25;
    relationship.maxTradeAmount = dto.maxTradeAmount ?? relationship.maxTradeAmount ?? 1000;
    relationship.stopLossPercentage = dto.stopLossPercentage ?? relationship.stopLossPercentage ?? 8;
    relationship.dailyLossLimitPercentage =
      dto.dailyLossLimitPercentage ?? relationship.dailyLossLimitPercentage ?? 5;
    relationship.copyRatio = dto.copyRatio ?? relationship.copyRatio ?? 1;
    relationship.slippageTolerancePercentage =
      dto.slippageTolerancePercentage ?? relationship.slippageTolerancePercentage ?? 1;
    relationship.autoExecute = dto.autoExecute ?? relationship.autoExecute ?? true;
    relationship.isActive = true;

    const saved = await this.copyRelationshipRepository.save(relationship);
    await this.refreshProfileSummary(dto.traderId);
    return saved;
  }

  async getCopyRelationshipsForFollower(followerId: number) {
    return this.copyRelationshipRepository.find({
      where: { followerId },
      order: { updatedAt: 'DESC' },
    });
  }

  async addStrategyComment(strategyId: number, dto: AddStrategyCommentDto) {
    const strategy = await this.strategyRepository.findOne({ where: { id: strategyId } });
    if (!strategy) {
      throw new NotFoundException(`Strategy ${strategyId} not found`);
    }
    await this.ensureUserExists(dto.userId);

    const saved = await this.commentRepository.save(
      this.commentRepository.create({
        strategyId,
        userId: dto.userId,
        content: dto.content,
      }),
    );
    await this.refreshProfileSummary(strategy.traderId);
    return saved;
  }

  async toggleStrategyLike(strategyId: number, userId: number) {
    const strategy = await this.strategyRepository.findOne({ where: { id: strategyId } });
    if (!strategy) {
      throw new NotFoundException(`Strategy ${strategyId} not found`);
    }
    await this.ensureUserExists(userId);

    const existing = await this.likeRepository.findOne({ where: { strategyId, userId } });
    if (existing) {
      await this.likeRepository.remove(existing);
      await this.refreshProfileSummary(strategy.traderId);
      return { liked: false };
    }

    await this.likeRepository.save(this.likeRepository.create({ strategyId, userId }));
    await this.refreshProfileSummary(strategy.traderId);
    return { liked: true };
  }

  async getLeaderboard(ranking: string = 'BALANCED', limit = 10): Promise<LeaderboardEntry[]> {
    const rankingKey = (ranking.toUpperCase() as keyof typeof SCORE_WEIGHT) in SCORE_WEIGHT
      ? (ranking.toUpperCase() as keyof typeof SCORE_WEIGHT)
      : 'BALANCED';

    const users = await this.userRepository.find();
    const entries: LeaderboardEntry[] = [];

    for (const user of users) {
      const profile = await this.ensureProfile(user.id, user.username);
      const performance = await this.buildTraderSnapshot(user.id);
      const score = this.calculateLeaderboardScore(performance, rankingKey);

      if (performance.totalTrades === 0 && profile.totalFollowers === 0 && profile.totalStrategies === 0) {
        continue;
      }

      entries.push({
        rank: 0,
        traderId: user.id,
        displayName: profile.displayName,
        score,
        roi: performance.roi,
        winRate: performance.winRate,
        totalVolume: performance.totalVolume,
        followerCount: performance.followerCount,
        activeCopiers: performance.activeCopiers,
        copiedVolume: performance.copiedVolume,
      });
    }

    return entries
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }

  async getPerformanceAnalytics(traderId: number) {
    const snapshot = await this.buildTraderSnapshot(traderId);
    const [recentTrades, recentCopiedTrades, strategies] = await Promise.all([
      this.tradeRepository.find({
        where: { userId: traderId },
        order: { timestamp: 'DESC' },
        take: 10,
      }),
      this.copiedTradeRepository.find({
        where: { traderId },
        order: { createdAt: 'DESC' },
        take: 10,
      }),
      this.strategyRepository.find({ where: { traderId, isActive: true } }),
    ]);

    return {
      ...snapshot,
      execution: {
        recentTrades,
        copiedTrades: recentCopiedTrades,
        synchronizationHealth: {
          executed: recentCopiedTrades.filter((trade) => trade.status === CopiedTradeStatus.EXECUTED).length,
          skipped: recentCopiedTrades.filter((trade) => trade.status === CopiedTradeStatus.SKIPPED).length,
          failed: recentCopiedTrades.filter((trade) => trade.status === CopiedTradeStatus.FAILED).length,
        },
      },
      strategyCoverage: strategies.map((strategy) => ({
        strategyId: strategy.id,
        title: strategy.title,
        asset: strategy.asset,
        riskLevel: strategy.riskLevel,
      })),
    };
  }

  async distributeRevenueShares(period = 'MONTHLY') {
    const leaderboard = await this.getLeaderboard('BALANCED', 10);
    const payoutRates = [0.3, 0.22, 0.18, 0.15, 0.12, 0.1, 0.08, 0.07, 0.06, 0.05];
    const records: TraderRevenueShare[] = [];

    for (const entry of leaderboard) {
      if (entry.copiedVolume <= 0 || entry.activeCopiers <= 0) {
        continue;
      }

      const grossRevenue = entry.copiedVolume * 0.0025;
      const traderShareRate = payoutRates[entry.rank - 1] ?? 0.05;
      const traderPayout = grossRevenue * traderShareRate;
      const record = this.revenueShareRepository.create({
        traderId: entry.traderId,
        period,
        grossRevenue,
        platformCommissionRate: 0.0025,
        traderShareRate,
        traderPayout,
        ranking: entry.rank,
        followerCountSnapshot: entry.followerCount,
      });
      records.push(await this.revenueShareRepository.save(record));
      await this.refreshProfileSummary(entry.traderId);
    }

    return {
      period,
      distributedTo: records.length,
      records,
    };
  }

  async synchronizeTradeExecution(event: TradeExecutionEvent) {
    const relationships = await this.copyRelationshipRepository.find({
      where: { traderId: event.userId, isActive: true, autoExecute: true },
      order: { updatedAt: 'DESC' },
    });

    if (relationships.length === 0) {
      return [];
    }

    const results: CopiedTrade[] = [];

    for (const relationship of relationships) {
      const strategy = relationship.strategyId
        ? await this.strategyRepository.findOne({ where: { id: relationship.strategyId } })
        : null;

      if (strategy && strategy.asset !== event.asset) {
        continue;
      }

      const requestedAmount = event.amount * this.toNumber(relationship.copyRatio);
      const allocationCap = event.amount * (this.toNumber(relationship.maxAllocationPercentage) / 100);
      const notionalCapAmount = event.price > 0 ? this.toNumber(relationship.maxTradeAmount) / event.price : 0;
      const executedAmount = this.roundAmount(
        Math.max(0, Math.min(requestedAmount, allocationCap || requestedAmount, notionalCapAmount || requestedAmount)),
      );
      const dailyLossBudget = this.toNumber(relationship.maxTradeAmount) *
        (this.toNumber(relationship.dailyLossLimitPercentage) / 100);
      const estimatedLoss = executedAmount * event.price *
        (this.toNumber(relationship.stopLossPercentage) / 100);

      if (executedAmount <= 0) {
        results.push(
          await this.persistCopiedTrade(relationship, event, {
            executedAmount: 0,
            status: CopiedTradeStatus.SKIPPED,
            riskAdjusted: true,
            failureReason: 'Risk settings reduced executable size to zero',
            estimatedLoss,
            dailyLossBudget,
          }),
        );
        continue;
      }

      if (estimatedLoss > dailyLossBudget) {
        results.push(
          await this.persistCopiedTrade(relationship, event, {
            executedAmount: 0,
            status: CopiedTradeStatus.SKIPPED,
            riskAdjusted: true,
            failureReason: 'Daily loss budget would be exceeded',
            estimatedLoss,
            dailyLossBudget,
          }),
        );
        continue;
      }

      const slippageFactor = this.toNumber(relationship.slippageTolerancePercentage) / 100;
      const executedPrice = this.roundPrice(
        event.type === 'BUY'
          ? event.price * (1 + slippageFactor / 10)
          : event.price * (1 - slippageFactor / 10),
      );
      const copiedTrade = await this.persistCopiedTrade(relationship, event, {
        executedAmount,
        executedPrice,
        status: CopiedTradeStatus.EXECUTED,
        riskAdjusted: executedAmount !== requestedAmount,
        failureReason: null,
        estimatedLoss,
        dailyLossBudget,
      });

      relationship.lastSyncedTradeId = event.tradeId;
      relationship.totalCopiedTrades += 1;
      relationship.copiedVolume = this.toNumber(relationship.copiedVolume) + executedAmount * executedPrice;
      await this.copyRelationshipRepository.save(relationship);
      results.push(copiedTrade);

      this.eventEmitter.emit('social.trade.copied', {
        traderId: event.userId,
        followerId: relationship.followerId,
        sourceTradeId: event.tradeId,
        copiedTradeId: copiedTrade.id,
      });
    }

    await this.refreshProfileSummary(event.userId);
    return results;
  }

  private async getStrategyAnalytics(strategy: SharedStrategy) {
    const traderTrades = await this.tradeRepository.find({
      where: { userId: strategy.traderId, asset: strategy.asset },
      order: { timestamp: 'ASC' },
    });
    const snapshot = this.calculatePerformanceSnapshot(strategy.traderId, traderTrades, 0, 0, 0);

    return {
      asset: strategy.asset,
      totalTrades: snapshot.totalTrades,
      roi: snapshot.roi,
      winRate: snapshot.winRate,
      averageTradeSize: snapshot.averageTradeSize,
    };
  }

  private async buildTraderSnapshot(traderId: number): Promise<TraderPerformanceSnapshot> {
    const [trades, followerCount, copyRelationships] = await Promise.all([
      this.tradeRepository.find({
        where: { userId: traderId },
        order: { timestamp: 'ASC' },
      }),
      this.followRepository.count({ where: { traderId } }),
      this.copyRelationshipRepository.find({ where: { traderId, isActive: true } }),
    ]);

    const activeCopiers = copyRelationships.length;
    const copiedVolume = copyRelationships.reduce(
      (sum, relationship) => sum + this.toNumber(relationship.copiedVolume),
      0,
    );

    return this.calculatePerformanceSnapshot(traderId, trades, followerCount, activeCopiers, copiedVolume);
  }

  private calculatePerformanceSnapshot(
    traderId: number,
    trades: Trade[],
    followerCount: number,
    activeCopiers: number,
    copiedVolume: number,
  ): TraderPerformanceSnapshot {
    const pnlSeries = trades.map((trade) => this.getTradePnl(trade));
    const netPnl = pnlSeries.reduce((sum, value) => sum + value, 0);
    const totalVolume = trades.reduce(
      (sum, trade) => sum + this.toNumber(trade.amount) * this.toNumber(trade.price),
      0,
    );
    const totalTrades = trades.length;
    const wins = pnlSeries.filter((value) => value > 0).length;
    const winRate = totalTrades > 0 ? wins / totalTrades : 0;
    const averageTradeSize = totalTrades > 0 ? totalVolume / totalTrades : 0;

    let equity = 0;
    let peak = 0;
    let maxDrawdown = 0;

    for (const pnl of pnlSeries) {
      equity += pnl;
      peak = Math.max(peak, equity);
      const drawdown = peak > 0 ? (peak - equity) / peak : 0;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }

    return {
      traderId,
      totalTrades,
      totalVolume,
      netPnl,
      roi: totalVolume > 0 ? netPnl / totalVolume : 0,
      winRate,
      averageTradeSize,
      maxDrawdown,
      followerCount,
      activeCopiers,
      copiedVolume,
    };
  }

  private calculateLeaderboardScore(
    snapshot: TraderPerformanceSnapshot,
    ranking: keyof typeof SCORE_WEIGHT,
  ): number {
    const weights = SCORE_WEIGHT[ranking];
    const roiScore = snapshot.roi * 100;
    const winRateScore = snapshot.winRate * 100;
    const volumeScore = Math.log10(snapshot.totalVolume + 1) * 10;
    const followerScore = snapshot.followerCount * 2;
    const copiedScore = Math.log10(snapshot.copiedVolume + 1) * 10 + snapshot.activeCopiers * 3;

    return this.roundPrice(
      roiScore * weights.roi +
        winRateScore * weights.winRate +
        volumeScore * weights.volume +
        followerScore * weights.followers +
        copiedScore * weights.copied,
    );
  }

  private async persistCopiedTrade(
    relationship: CopyTradingRelationship,
    event: TradeExecutionEvent,
    options: {
      executedAmount: number;
      executedPrice?: number;
      status: CopiedTradeStatus;
      riskAdjusted: boolean;
      failureReason: string | null;
      estimatedLoss: number;
      dailyLossBudget: number;
    },
  ) {
    return this.copiedTradeRepository.save(
      this.copiedTradeRepository.create({
        relationshipId: relationship.id,
        sourceTradeId: event.tradeId,
        traderId: event.userId,
        followerId: relationship.followerId,
        asset: event.asset,
        side: event.type,
        requestedAmount: event.amount * this.toNumber(relationship.copyRatio),
        executedAmount: options.executedAmount,
        sourcePrice: event.price,
        executedPrice: options.executedPrice ?? 0,
        status: options.status,
        riskAdjusted: options.riskAdjusted,
        realizedPnl: 0,
        failureReason: options.failureReason,
        metadata: {
          estimatedLoss: options.estimatedLoss,
          dailyLossBudget: options.dailyLossBudget,
          synchronizedAt: new Date().toISOString(),
        },
        executedAt: options.status === CopiedTradeStatus.EXECUTED ? new Date() : null,
      }),
    );
  }

  private async refreshProfileSummary(traderId: number) {
    const user = await this.ensureUserExists(traderId);
    const profile = await this.ensureProfile(traderId, user.username);
    const strategies =
      (await this.strategyRepository.find({ where: { traderId } })) ?? [];
    const strategyIds = strategies.map((strategy) => strategy.id);
    const [followers, activeRelationshipsResult, revenuesResult] = await Promise.all([
      this.followRepository.count({ where: { traderId } }),
      this.copyRelationshipRepository.find({ where: { traderId, isActive: true } }),
      this.revenueShareRepository.find({ where: { traderId } }),
    ]);
    const activeRelationships = activeRelationshipsResult ?? [];
    const revenues = revenuesResult ?? [];

    const totalLikes =
      strategyIds.length > 0
        ? await this.likeRepository.count({ where: { strategyId: In(strategyIds) } })
        : 0;
    const copiedAssetsUnderManagement = activeRelationships.reduce(
      (sum, relationship) => sum + this.toNumber(relationship.maxTradeAmount),
      0,
    );
    const revenueShareEarned = revenues.reduce(
      (sum, record) => sum + this.toNumber(record.traderPayout),
      0,
    );

    profile.totalFollowers = followers;
    profile.totalStrategies = strategies.length;
    profile.totalLikes = totalLikes;
    profile.copiedAssetsUnderManagement = copiedAssetsUnderManagement;
    profile.revenueShareEarned = revenueShareEarned;
    profile.score = followers * 5 + strategies.length * 4 + totalLikes * 2 + activeRelationships.length * 6;

    await this.profileRepository.save(profile);
  }

  private async ensureProfile(userId: number, displayName?: string) {
    const existing = await this.profileRepository.findOne({ where: { userId } });
    if (existing) {
      return existing;
    }

    const user = await this.ensureUserExists(userId);
    return this.profileRepository.save(
      this.profileRepository.create({
        userId,
        displayName: displayName ?? user.username,
      }),
    );
  }

  private async ensureUserExists(userId: number) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    return user;
  }

  private async ensureDistinctUsers(sourceUserId: number, targetUserId: number, action: string) {
    if (sourceUserId === targetUserId) {
      throw new BadRequestException(`Users cannot ${action} themselves`);
    }
  }

  private getTradePnl(trade: Trade) {
    const metadataPnl = this.toNumber((trade.metadata as { pnl?: number } | null)?.pnl ?? 0);
    if (metadataPnl !== 0) {
      return metadataPnl;
    }

    const direction = trade.type === 'SELL' ? 1 : -1;
    return direction * this.toNumber(trade.amount) * this.toNumber(trade.price);
  }

  private toNumber(value: unknown) {
    return Number(value ?? 0);
  }

  private roundAmount(value: number) {
    return Number(value.toFixed(8));
  }

  private roundPrice(value: number) {
    return Number(value.toFixed(4));
  }
}
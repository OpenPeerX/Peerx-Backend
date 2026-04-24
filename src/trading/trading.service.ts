import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserBadgeService } from '../rewards/services/user-badge.service';
import { UserService } from '../user/user.service';
import { Trade } from './entities/trade.entity';
import { TradeType } from '../common/enums/trade-type.enum';
import { VirtualAsset } from './entities/virtual-asset.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationEventType } from '../common/enums/notification-event-type.enum';
import { OrderBook } from './entities/order-book.entity';
import { OrderType } from '../common/enums/order-type.enum';
import { OrderStatus } from '../common/enums/order-status.enum';
import { MatchingEngineService } from './machine-engine.service';
import { CacheService } from '../common/services/cache.service';

@Injectable()
export class TradingService {
  private readonly logger = new Logger(TradingService.name);

  constructor(
    private readonly userBadgeService: UserBadgeService,
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
    @InjectRepository(Trade)
    private readonly tradeRepository: Repository<Trade>,
    @InjectRepository(VirtualAsset)
    private readonly assetRepository: Repository<VirtualAsset>,
    @InjectRepository(OrderBook)
    private readonly orderBookRepository: Repository<OrderBook>,
    private readonly matchingEngine: MatchingEngineService,
    private readonly cacheService: CacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async swap(
    userId: number,
    asset: string,
    amount: number,
    price: number,
    type: string,
  ): Promise<{
    success: boolean;
    trade?: Trade;
    badgeAwarded?: boolean;
    error?: string;
  }> {
    // Validate input
    if (!userId || !asset || !amount || !price || !type) {
      return { success: false, error: 'Missing required swap parameters.' };
    }

    // Lookup asset
    const assetEntity = await this.assetRepository.findOne({ where: { symbol: asset } });
    if (!assetEntity) {
      return { success: false, error: `Asset ${asset} not found` };
    }
    const assetId = assetEntity.id;

    let trade: Trade;
    let badgeAwarded = false;
    try {
      // Convert type string to TradeType enum
      const tradeTypeEnum = type === 'BUY' ? TradeType.BUY : TradeType.SELL;
      trade = this.tradeRepository.create({
        userId,
        asset,
        amount,
        price,
        type: tradeTypeEnum,
      });
      await this.tradeRepository.save(trade);

      // Emit order filled notification
      await this.notificationService.sendEvent(
        userId,
        NotificationEventType.ORDER_FILLED,
        `Order ${type} ${amount} ${asset} at ${price} filled`,
      );

      // Calculate trade value
      const tradeValue = amount * price;
      const pnl = tradeTypeEnum === TradeType.BUY ? -tradeValue : tradeValue;

      // Update portfolio after successful trade
      await this.userService.updatePortfolioAfterTrade(
        userId,
        assetId,
        tradeValue,
        pnl,
      );

      // Update user balance
      const balanceChange = tradeTypeEnum === TradeType.BUY ? amount : -amount;
      await this.userService.updateBalance(
        userId,
        assetId,
        balanceChange,
      );

      // Check if this is the user's first trade (with eager loading)
      const previousTrades = await this.tradeRepository.count({
        where: { userId },
      });
      if (previousTrades === 1) {
        // Only award if this is the first
        const badgeName = 'First Trade';
        const badge = await this.userBadgeService.awardBadge(userId, badgeName);
        badgeAwarded = !!badge;
        if (badgeAwarded) {
          await this.notificationService.sendEvent(
            userId,
            NotificationEventType.ACHIEVEMENT_UNLOCKED,
            `Achievement unlocked: ${badgeName}`,
          );
        }
      }

      // Invalidate cache after trade execution
      await this.cacheService.invalidateTradeRelatedCaches(userId.toString(), asset);

      this.eventEmitter.emit('trading.trade.executed', {
        tradeId: trade.id,
        userId,
        asset,
        amount,
        price,
        type: tradeTypeEnum,
        executedAt: trade.timestamp ?? new Date(),
        notionalValue: tradeValue,
        pnl,
      });

      return { success: true, trade, badgeAwarded };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async placeOrder(
    userId: number,
    asset: string,
    type: OrderType,
    amount: number,
    price: number,
  ): Promise<any> {
    try {
      const order = this.orderBookRepository.create({
        userId,
        asset,
        type,
        amount,
        price,
        status: OrderStatus.PENDING,
        filledAmount: 0,
        remainingAmount: amount,
      });

      return await this.orderBookRepository.save(order);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getOrderBook(asset: string): Promise<OrderBook[]> {
    return this.orderBookRepository.find({
      where: { asset, status: OrderStatus.PENDING },
      order: { price: 'ASC' },
    });
  }

  async cancelOrder(orderId: number, userId: number): Promise<any> {
    try {
      const order = await this.orderBookRepository.findOne({
        where: { id: orderId, userId },
      });

      if (!order) {
        return { success: false, error: 'Order not found' };
      }

      order.status = OrderStatus.CANCELLED;
      await this.orderBookRepository.save(order);

      return { success: true, order };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async executeOrder(orderId: number): Promise<any> {
    try {
      const order = await this.orderBookRepository.findOne({
        where: { id: orderId },
      });

      if (!order) {
        return { success: false, error: 'Order not found' };
      }

      order.status = OrderStatus.FILLED;
      order.filledAmount = order.amount;
      order.remainingAmount = 0;
      order.executedAt = new Date();

      await this.orderBookRepository.save(order);

      return { success: true, order };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute matching cycle for all active orders
   * This would typically be called periodically or on new order submission
   */
  async executeMatchingCycle(
    bids: OrderBook[],
    asks: OrderBook[],
  ): Promise<{
    success: boolean;
    tradesExecuted: number;
    totalVolume: number;
    executionTime: number;
  }> {
    try {
      this.logger.log(
        `Starting matching cycle: ${bids.length} bids, ${asks.length} asks`,
      );

      // Transform OrderBook entities to Order interface expected by matching engine
      const transformedBids = bids.map(order => ({
        id: order.id.toString(),
        userId: order.userId.toString(),
        asset: order.asset,
        amount: order.amount,
        price: order.price,
        remainingAmount: order.remainingAmount,
        timestamp: order.createdAt,
        type: order.type === OrderType.BUY ? 'BID' : 'ASK' as 'BID' | 'ASK',
      }));

      const transformedAsks = asks.map(order => ({
        id: order.id.toString(),
        userId: order.userId.toString(),
        asset: order.asset,
        amount: order.amount,
        price: order.price,
        remainingAmount: order.remainingAmount,
        timestamp: order.createdAt,
        type: order.type === OrderType.BUY ? 'BID' : 'ASK' as 'BID' | 'ASK',
      }));

      const result = await this.matchingEngine.matchTrades(transformedBids, transformedAsks);

      this.logger.log(
        `Matching cycle complete: ${result.tradesExecuted} trades executed, ` +
          `${result.failedMatches} failed, ${result.executionTime}ms`,
      );

      return {
        success: true,
        tradesExecuted: result.tradesExecuted,
        totalVolume: result.totalVolume,
        executionTime: result.executionTime,
      };
    } catch (error) {
      this.logger.error(`Matching cycle failed: ${error.message}`, error.stack);
      return {
        success: false,
        tradesExecuted: 0,
        totalVolume: 0,
        executionTime: 0,
      };
    }
  }

  /**
   * Get user trade history
   */
  async getUserTrades(userId: string, limit = 100) {
    return this.matchingEngine.getTradeHistory(userId, limit);
  }

  /**
   * Get trades for specific asset
   */
  async getAssetTrades(asset: string, limit = 100) {
    return this.matchingEngine.getAssetTrades(asset, limit);
  }

  /**
   * Batch load trades for multiple users - optimized for DataLoader
   * Reduces N+1 queries by fetching all user trades in a single query
   */
  async getTradesForUsers(userIds: string[]): Promise<Record<string, Trade[]>> {
    const startTime = Date.now();
    
    // Single query to get all trades for all users
    const trades = await this.tradeRepository
      .createQueryBuilder('trade')
      .where('trade.userId IN (:...userIds)', { userIds })
      .orderBy('trade.timestamp', 'DESC')
      .getMany();

    // Group trades by user
    const tradesByUser: Record<string, Trade[]> = {};
    userIds.forEach(userId => {
      tradesByUser[userId] = [];
    });

    trades.forEach(trade => {
      if (tradesByUser[trade.userId]) {
        tradesByUser[trade.userId].push(trade);
      }
    });

    const duration = Date.now() - startTime;
    this.logger.log(`Batch loaded trades for ${userIds.length} users in ${duration}ms (${trades.length} total trades)`);

    return tradesByUser;
  }

  /**
   * Batch load trades for multiple assets - optimized for DataLoader
   */
  async getTradesForAssets(assets: string[]): Promise<Record<string, Trade[]>> {
    const startTime = Date.now();
    
    const trades = await this.tradeRepository
      .createQueryBuilder('trade')
      .where('trade.asset IN (:...assets)', { assets })
      .orderBy('trade.timestamp', 'DESC')
      .limit(1000) // Limit to prevent memory issues
      .getMany();

    const tradesByAsset: Record<string, Trade[]> = {};
    assets.forEach(asset => {
      tradesByAsset[asset] = [];
    });

    trades.forEach(trade => {
      if (tradesByAsset[trade.asset]) {
        tradesByAsset[trade.asset].push(trade);
      }
    });

    const duration = Date.now() - startTime;
    this.logger.log(`Batch loaded trades for ${assets.length} assets in ${duration}ms (${trades.length} total trades)`);

    return tradesByAsset;
  }

  /**
   * Batch load trades by IDs - optimized for DataLoader
   */
  async getTradesByIds(tradeIds: number[]): Promise<Trade[]> {
    const startTime = Date.now();
    
    const trades = await this.tradeRepository
      .createQueryBuilder('trade')
      .where('trade.id IN (:...tradeIds)', { tradeIds })
      .getMany();

    const duration = Date.now() - startTime;
    this.logger.log(`Batch loaded ${tradeIds.length} trades by ID in ${duration}ms`);

    return trades;
  }
}

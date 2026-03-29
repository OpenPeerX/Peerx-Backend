import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RiskOrder, RiskOrderStatus, RiskOrderType, RiskOrderSide } from '../entities/risk-order.entity';
import { MarketData } from '../../trading/entities/market-data.entity';
import { TradingService } from '../../trading/trading.service';
import { NotificationService } from '../../notification/notification.service';
import { NotificationEventType } from '../../common/enums/notification-event-type.enum';

@Injectable()
export class RiskOrderService {
  private readonly logger = new Logger(RiskOrderService.name);

  constructor(
    @InjectRepository(RiskOrder)
    private readonly riskOrderRepository: Repository<RiskOrder>,
    @InjectRepository(MarketData)
    private readonly marketDataRepository: Repository<MarketData>,
    private readonly tradingService: TradingService,
    private readonly notificationService: NotificationService,
  ) {}

  async createRiskOrder(
    userId: number,
    asset: string,
    orderType: RiskOrderType,
    side: RiskOrderSide,
    amount: number,
    triggerPrice: number,
  ): Promise<RiskOrder> {
    const order = this.riskOrderRepository.create({
      userId,
      asset,
      orderType,
      side,
      amount,
      triggerPrice,
      status: RiskOrderStatus.PENDING,
    });
    return this.riskOrderRepository.save(order);
  }

  async cancelRiskOrder(userId: number, orderId: number): Promise<boolean> {
    const order = await this.riskOrderRepository.findOne({ where: { id: orderId, userId } });
    if (!order || order.status !== RiskOrderStatus.PENDING) {
      return false;
    }
    order.status = RiskOrderStatus.CANCELLED;
    await this.riskOrderRepository.save(order);
    return true;
  }

  async getActiveOrders(userId: number): Promise<RiskOrder[]> {
    return this.riskOrderRepository.find({
      where: { userId, status: RiskOrderStatus.PENDING },
      order: { createdAt: 'DESC' },
    });
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processRiskOrders() {
    this.logger.log('Evaluating pending risk orders...');
    
    const pendingOrders = await this.riskOrderRepository.find({
      where: { status: RiskOrderStatus.PENDING },
    });

    if (pendingOrders.length === 0) return;

    // Fetch latest market prices for all assets involved
    const assetSymbols = [...new Set(pendingOrders.map(o => o.asset))];
    const marketDataList = await this.marketDataRepository.find({
      where: assetSymbols.map(asset => ({ asset })),
    });

    const priceMap: Record<string, number> = {};
    for (const md of marketDataList) {
      priceMap[md.asset] = Number(md.currentPrice);
    }

    for (const order of pendingOrders) {
      const currentPrice = priceMap[order.asset];
      if (!currentPrice) continue; // Skip if no price data

      let shouldExecute = false;

      if (order.orderType === RiskOrderType.STOP_LOSS) {
        if (order.side === RiskOrderSide.SELL && currentPrice <= Number(order.triggerPrice)) {
          shouldExecute = true; // Price dropped below stop-loss
        } else if (order.side === RiskOrderSide.BUY && currentPrice >= Number(order.triggerPrice)) {
          shouldExecute = true; // Short covering stop-loss
        }
      } else if (order.orderType === RiskOrderType.TAKE_PROFIT) {
        if (order.side === RiskOrderSide.SELL && currentPrice >= Number(order.triggerPrice)) {
          shouldExecute = true; // Price reached target profit
        } else if (order.side === RiskOrderSide.BUY && currentPrice <= Number(order.triggerPrice)) {
          shouldExecute = true; // Short covering take-profit
        }
      }

      if (shouldExecute) {
        await this.executeOrder(order, currentPrice);
      }
    }
  }

  private async executeOrder(order: RiskOrder, executionPrice: number) {
    try {
      this.logger.log(`Executing Risk Order ${order.id} for user ${order.userId}`);
      const typeStr = order.side === RiskOrderSide.BUY ? 'BUY' : 'SELL';
      
      const res = await this.tradingService.swap(
        order.userId,
        order.asset,
        order.amount,
        executionPrice,
        typeStr
      );

      if (res.success) {
        order.status = RiskOrderStatus.EXECUTED;
        order.executedAt = new Date();
        order.executionPrice = executionPrice;
        await this.riskOrderRepository.save(order);

        await this.notificationService.sendEvent(
          order.userId,
          NotificationEventType.ORDER_FILLED, // Using existing event types
          `Your ${order.orderType} order for ${order.amount} ${order.asset} was executed at ${executionPrice}.`
        );
      } else {
        this.logger.error(`Risk order execution failed for order ${order.id}: ${res.error}`);
        // Optionally notify user of failure due to insufficient balance
      }
    } catch (error) {
      this.logger.error(`Error executing risk order ${order.id}`, error);
    }
  }
}

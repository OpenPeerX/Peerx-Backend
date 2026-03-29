import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SocialTradingService } from './social-trading.service';
import type { TradeExecutionEvent } from './interfaces/social-trading.interfaces';

@Injectable()
export class SocialTradingSyncService {
  constructor(private readonly socialTradingService: SocialTradingService) {}

  @OnEvent('trading.trade.executed', { async: true })
  async handleTradeExecuted(event: TradeExecutionEvent) {
    await this.socialTradingService.synchronizeTradeExecution(event);
  }
}
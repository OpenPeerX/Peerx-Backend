import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradingController } from './trading.controller';
import { BotTradingController } from './bot-trading.controller';
import { TradingService } from './trading.service';
import { SettlementService } from './settlement.service';
import { MatchingEngineService } from './matching-engine.service';
import { UserBadgeModule } from '../rewards/user-badge.module';
import { UserModule } from '../user/user.module';
import { NotificationModule } from '../notification/notification.module';
import { CacheModule } from '../common/cache/cache.module';
import { MatchingEngineModule } from './matching-engine/matching-engine.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { Trade } from './entities/trade.entity';
import { VirtualAsset } from './entities/virtual-asset.entity';
import { OrderBook } from './entities/order-book.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trade, VirtualAsset, OrderBook]),
    UserBadgeModule,
    UserModule,
    NotificationModule,
    CacheModule,
    MatchingEngineModule,
    BlockchainModule,
  ],
  controllers: [TradingController, BotTradingController],
  providers: [TradingService, MatchingEngineService, SettlementService],
  exports: [TradingService],
})
export class TradingModule { }


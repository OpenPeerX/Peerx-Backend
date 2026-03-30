import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { Trade } from '../trading/entities/trade.entity';
import { SocialTradingController } from './social-trading.controller';
import { SocialTradingService } from './social-trading.service';
import { SocialTradingSyncService } from './social-trading-sync.service';
import { SocialTraderProfile } from './entities/social-trader-profile.entity';
import { SharedStrategy } from './entities/shared-strategy.entity';
import { TraderFollow } from './entities/trader-follow.entity';
import { CopyTradingRelationship } from './entities/copy-trading-relationship.entity';
import { CopiedTrade } from './entities/copied-trade.entity';
import { StrategyComment } from './entities/strategy-comment.entity';
import { StrategyLike } from './entities/strategy-like.entity';
import { TraderRevenueShare } from './entities/trader-revenue-share.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Trade,
      SocialTraderProfile,
      SharedStrategy,
      TraderFollow,
      CopyTradingRelationship,
      CopiedTrade,
      StrategyComment,
      StrategyLike,
      TraderRevenueShare,
    ]),
  ],
  controllers: [SocialTradingController],
  providers: [SocialTradingService, SocialTradingSyncService],
  exports: [SocialTradingService],
})
export class SocialTradingModule {}
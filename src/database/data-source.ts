import { DataSource } from 'typeorm';
import { VirtualAsset } from '../trading/entities/virtual-asset.entity';
import { UserBalance } from '../balance/entities/user-balance.entity';
import { User } from '../user/entities/user.entity';
import { Trade } from '../trading/entities/trade.entity';
import { Portfolio } from '../portfolio/entities/portfolio.entity';
import { Reward } from '../rewards/entities/reward.entity';
import { Notification } from '../notification/entities/notification.entity';
import { Bid } from '../bidding/entities/bid.entity';
import { ReferralCode } from '../referral/entities/referral-code.entity';
import { Referral } from '../referral/entities/referral.entity';
import { ReferralReward } from '../referral/entities/referral-reward.entity';
import { LeaderboardCache } from '../referral/entities/leaderboard-cache.entity';
import { WaitlistUser } from '../waitlist/entities/waitlist-user.entity';
import { WaitlistVerificationToken } from '../waitlist/entities/waitlist-verification-token.entity';
import { SocialTraderProfile } from '../social-trading/entities/social-trader-profile.entity';
import { SharedStrategy } from '../social-trading/entities/shared-strategy.entity';
import { TraderFollow } from '../social-trading/entities/trader-follow.entity';
import { CopyTradingRelationship } from '../social-trading/entities/copy-trading-relationship.entity';
import { CopiedTrade } from '../social-trading/entities/copied-trade.entity';
import { StrategyComment } from '../social-trading/entities/strategy-comment.entity';
import { StrategyLike } from '../social-trading/entities/strategy-like.entity';
import { TraderRevenueShare } from '../social-trading/entities/trader-revenue-share.entity';

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: 'swaptrade.db',
  entities: [
    VirtualAsset,
    UserBalance,
    User,
    Trade,
    Portfolio,
    Reward,
    Notification,
    Bid,
    ReferralCode,
    Referral,
    ReferralReward,
    LeaderboardCache,
    WaitlistUser,
    WaitlistVerificationToken,
    SocialTraderProfile,
    SharedStrategy,
    TraderFollow,
    CopyTradingRelationship,
    CopiedTrade,
    StrategyComment,
    StrategyLike,
    TraderRevenueShare,
  ],
  migrations: ['src/database/migrations/*.ts'],
  migrationsTableName: 'migrations',
  synchronize: false, // Set to false when using migrations
  logging: true,
});

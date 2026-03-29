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
  ],
  migrations: ['src/database/migrations/*.ts'],
  migrationsTableName: 'migrations',
  synchronize: false, // Set to false when using migrations
  logging: true,
});

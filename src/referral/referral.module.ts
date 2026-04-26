import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferralService } from './referral.service';
import { ReferralController } from './referral.controller';
import { ReferralAdminService } from './referral-admin.service';
import { ReferralAdminController } from './referral-admin.controller';
import { Referral } from './entities/referral.entity';
import { ReferralConfig } from './entities/referral-config.entity';
import { ReferralDispute } from './entities/referral-dispute.entity';
import { User } from '../user/entities/user.entity';
import { NotificationModule } from '../notification/notification.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { UserBalance } from 'src/balance/entities/user-balance.entity';
import { BalanceAudit } from 'src/balance/balance-audit.entity';
import { Trade } from 'src/trading/entities/trade.entity';
import { LeaderboardController } from './leaderboard.controller';
import { ReferralServiceExtended } from './referral.service.extended';
import { ReferralTrackingMiddleware } from './referral.tracking.middleware';
import { ReferralCodeService } from './referral-code.service';
import { ReferralCode } from './entities/referral-code.entity';
import { ReferralReward } from './entities/referral-reward.entity';
// #334 — Affiliate Program
import { Affiliate } from './entities/affiliate.entity';
import { AffiliatePayout } from './entities/affiliate-payout.entity';
import { AffiliateService } from './affiliate.service';
import { AffiliateController } from './affiliate.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Referral,
      ReferralConfig,
      ReferralDispute,
      User,
      UserBalance,
      BalanceAudit,
      Trade,
      ReferralCode,
      ReferralReward,
      // #334 — Affiliate Program entities
      Affiliate,
      AffiliatePayout,
    ]),
    NotificationModule,
    AuditLogModule,
  ],
  controllers: [
    ReferralController,
    ReferralAdminController,
    LeaderboardController,
    // #334
    AffiliateController,
  ],
  providers: [
    ReferralService,
    ReferralAdminService,
    ReferralServiceExtended,
    ReferralCodeService,
    // #334
    AffiliateService,
  ],
  exports: [
    ReferralService,
    ReferralAdminService,
    ReferralServiceExtended,
    ReferralCodeService,
    // #334
    AffiliateService,
  ],
})
export class ReferralModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply referral tracking to all routes so ?ref= is always captured
    consumer.apply(ReferralTrackingMiddleware).forRoutes('*');
  }
}

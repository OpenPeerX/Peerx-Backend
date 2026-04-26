import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';
import { BadgeController } from './controllers/badge.controller';
import { UserBadgeService } from './services/user-badge.service';
import { UserBadge } from './entities/user-badge.entity';
// #335 — Bug Bonus
import { BugReport } from './entities/bug-report.entity';
import { BugBonusService } from './bug-bonus.service';
import { BugBonusController } from './bug-bonus.controller';
import { User } from '../user/entities/user.entity';
import { UserBalance } from '../balance/entities/user-balance.entity';
import { BalanceAudit } from '../balance/balance-audit.entity';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserBadge,
      // #335
      BugReport,
      User,
      UserBalance,
      BalanceAudit,
    ]),
    NotificationModule,
  ],
  controllers: [
    RewardsController,
    BadgeController,
    // #335
    BugBonusController,
  ],
  providers: [
    RewardsService,
    UserBadgeService,
    // #335
    BugBonusService,
  ],
  exports: [UserBadgeService, BugBonusService],
})
export class RewardsModule {}

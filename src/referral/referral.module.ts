import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    TypeOrmModule.forFeature([Referral, ReferralConfig, ReferralDispute, User]),
    NotificationModule,
    AuditLogModule,
  ],
  controllers: [ReferralController, ReferralAdminController],
  providers: [ReferralService, ReferralAdminService],
  exports: [ReferralService, ReferralAdminService],

})
export class ReferralModule {}

import { Module } from '@nestjs/common';
import { ReferralService } from './referral.service';
import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { ReferralService } from './referral.service';
import { FraudPreventionService } from './fraud-prevention.service';

@Module({
    imports: [NotificationModule, TypeOrmModule.forFeature([User])],
    providers: [ReferralService, FraudPreventionService],
    exports: [ReferralService, FraudPreventionService],
})
export class ReferralModule { }


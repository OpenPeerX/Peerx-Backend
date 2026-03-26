import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationService } from '../notification/notification.service';

export enum ReferralEvent {
    REFERRAL_SUCCESS = 'referral.success',
    REWARD_CREDITED = 'referral.reward.credited',
    LEADERBOARD_CHANGE = 'referral.leaderboard.change',
}

@Injectable()
export class ReferralService {
    constructor(
        private eventEmitter: EventEmitter2,
        private notificationService: NotificationService,
        @InjectRepository(User)
        private userRepo: Repository<User>,
    ) { }

    async handleReferral(referrerId: number, referredUserId: number) {
        // Referral logic...
        this.eventEmitter.emit(ReferralEvent.REFERRAL_SUCCESS, { referrerId, referredUserId });
    }

    async creditReward(userId: number, amount: number) {
        // Reward logic...
        this.eventEmitter.emit(ReferralEvent.REWARD_CREDITED, { userId, amount });
    }

    async updateLeaderboard(userId: number, position: number) {
        this.eventEmitter.emit(ReferralEvent.LEADERBOARD_CHANGE, { userId, position });
    }
}


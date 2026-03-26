import { Injectable, Logger, InjectRepository } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ReferralService } from './referral.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RateLimitService } from '../ratelimit/ratelimit.service';
import { User } from '../user/entities/user.entity';

export enum FraudRisk {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    BLOCK = 'BLOCK',
}

@Injectable()
export class FraudPreventionService {
    private readonly logger = new Logger(FraudPreventionService.name);

    constructor(
        private redis: Redis,
        private referralService: ReferralService,
        private auditService: AuditService,
        private rateLimitService: RateLimitService,
    ) { }

    async validateReferral(referrerId: number, ip: string, deviceFingerprint: string, referredEmail: string): Promise<FraudRisk> {
        const key = `fraud:referral:${referrerId}:${ip}`;
        const score = await this.calculateRiskScore(referrerId, ip, deviceFingerprint, referredEmail);

        await this.redis.set(key, score, 'EX', 3600); // 1hr cache
        await this.auditService.log('REFERRAL_VALIDATION', { referrerId, ip, deviceFingerprint, score, risk: score });

        if (score > 80) return FraudRisk.BLOCK;
        if (score > 60) return FraudRisk.HIGH;
        if (score > 40) return FraudRisk.MEDIUM;
        return FraudRisk.LOW;
    }

    private async calculateRiskScore(referrerId: number, ip: string, deviceFingerprint: string, referredEmail: string): Promise<number> {
        let score = 0;

        // IP rate limit
        const ipRefs = await this.redis.get(`referrals:ip:${ip}`);
        if (parseInt(ipRefs || '0') > 5) score += 30;

        // Device rate limit
        const deviceRefs = await this.redis.get(`referrals:device:${deviceFingerprint}`);
        if (parseInt(deviceRefs || '0') > 3) score += 25;

        // Referrer velocity
        const recentRefs = await this.redis.zcount(`referrals:${referrerId}`, '-3600', '+inf');
        if (recentRefs > 10) score += 20;

        // Email domain pattern
        if (referredEmail.endsWith('temp-mail.org') || referredEmail.includes('fake')) score += 15;

        // Self-referral
        if (referredEmail.includes(referrerId.toString())) score += 10;

        return Math.min(score, 100);
    }

    async flagForManualReview(referralId: number, reason: string) {
        await this.redis.sadd('fraud:manual_review', referralId.toString());
        await this.auditService.log('REFERRAL_FLAGGED_MANUAL', { referralId, reason });
        this.logger.warn(`Referral ${referralId} flagged for manual review: ${reason}`);
    }

    async getManualReviewQueue() {
        const flagged = await this.redis.smembers('fraud:manual_review');
        return flagged.map(id => parseInt(id));
    }

    async approveReferral(referralId: number) {
        await this.redis.srem('fraud:manual_review', referralId.toString());
        await this.auditService.log('REFERRAL_APPROVED_MANUAL', { referralId });
    }

    async rejectReferral(referralId: number, reason: string) {
        await this.redis.srem('fraud:manual_review', referralId.toString());
        await this.auditService.log('REFERRAL_REJECTED_MANUAL', { referralId, reason });
    }
}


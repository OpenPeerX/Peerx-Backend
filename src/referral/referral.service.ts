import {
  Injectable, BadRequestException, ConflictException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

const FRAUD_SAME_IP_THRESHOLD     = 10;
const FRAUD_SAME_DOMAIN_THRESHOLD = 5;
const FRAUD_SCORE_BLOCK           = 80;

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);

  constructor(
    @InjectRepository('waitlist_referrals')
    private readonly referralRepo: Repository<any>,
    @InjectRepository('waitlist_referral_points')
    private readonly pointsRepo: Repository<any>,
    @InjectRepository('waitlist_entries')
    private readonly waitlistRepo: Repository<any>,
    private readonly dataSource: DataSource,
  ) {}

  // #198 — referral callback (called after email verification)
  async processReferralCallback(
    refereeId: string,
    referrerCode: string,
    ip: string,
  ): Promise<{ success: boolean; message: string }> {
    const referee  = await this.waitlistRepo.findOne({ where: { id: refereeId } });
    const referrer = await this.waitlistRepo.findOne({ where: { referral_code: referrerCode } });

    if (!referee || !referrer)         throw new BadRequestException('Invalid referral or user');
    if (referee.status !== 'verified') throw new BadRequestException('Referee email not verified');
    if (referrer.id === refereeId)     throw new BadRequestException('Self-referral is not allowed');

    const existing = await this.referralRepo.findOne({ where: { referee_id: refereeId } });
    if (existing) throw new ConflictException('User already has a referral attribution');

    const fraudScore = await this.computeFraudScore(referrer.id, referee.email, ip);

    await this.dataSource.transaction(async (manager) => {
      const referral = manager.create('waitlist_referrals', {
        referrer_id: referrer.id,
        referee_id:  refereeId,
        status:      fraudScore >= FRAUD_SCORE_BLOCK ? 'flagged' : 'confirmed',
        fraud_score: fraudScore,
      });
      await manager.save(referral);

      if (fraudScore < FRAUD_SCORE_BLOCK) {
        const point = manager.create('waitlist_referral_points', {
          user_id: referrer.id,
          points:  1,
          reason:  `Referral confirmed: ${refereeId}`,
        });
        await manager.save(point);
        this.logger.log(`Point awarded to ${referrer.id} for referee ${refereeId}`);
      } else {
        this.logger.warn(`Referral flagged (score ${fraudScore}) from ${referrer.id}`);
      }
    });

    return {
      success: true,
      message: fraudScore >= FRAUD_SCORE_BLOCK
        ? 'Referral received but flagged for review'
        : 'Referral confirmed and point awarded',
    };
  }

  // #202 — fraud scoring
  async computeFraudScore(referrerId: string, refereeEmail: string, ip: string): Promise<number> {
    let score = 0;
    const domain = refereeEmail.split('@')[1];

    const [ipCount, domainCount] = await Promise.all([
      this.waitlistRepo.count({ where: { signup_ip: ip } }),
      this.waitlistRepo.count({ where: { email_domain: domain } }),
    ]);

    const referralCountFromReferrer = await this.referralRepo.count({
      where: { referrer_id: referrerId, status: 'confirmed' },
    });

    if (ipCount      > FRAUD_SAME_IP_THRESHOLD)     score += 40;
    if (domainCount  > FRAUD_SAME_DOMAIN_THRESHOLD)  score += 30;
    if (referralCountFromReferrer > 50)               score += 20;

    return Math.min(score, 100);
  }
}

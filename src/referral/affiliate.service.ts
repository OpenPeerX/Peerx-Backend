import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between } from 'typeorm';
import {
  Affiliate,
  AffiliateStatus,
  AffiliateCommissionTier,
} from './entities/affiliate.entity';
import {
  AffiliatePayout,
  AffiliatePayoutStatus,
} from './entities/affiliate-payout.entity';
import { User } from '../user/entities/user.entity';
import { Referral, ReferralStatus } from './entities/referral.entity';
import { NotificationService, NotificationChannel } from '../notification/notification.service';
import * as crypto from 'crypto';

// Commission rates per tier (percentage of referred user's first trade fee)
const COMMISSION_RATES: Record<AffiliateCommissionTier, number> = {
  [AffiliateCommissionTier.BRONZE]: 5.0,
  [AffiliateCommissionTier.SILVER]: 7.5,
  [AffiliateCommissionTier.GOLD]: 10.0,
  [AffiliateCommissionTier.PLATINUM]: 15.0,
};

// Tier thresholds (active referrals count)
const TIER_THRESHOLDS = {
  [AffiliateCommissionTier.SILVER]: 10,
  [AffiliateCommissionTier.GOLD]: 30,
  [AffiliateCommissionTier.PLATINUM]: 100,
};

@Injectable()
export class AffiliateService {
  private readonly logger = new Logger(AffiliateService.name);

  constructor(
    @InjectRepository(Affiliate)
    private readonly affiliateRepo: Repository<Affiliate>,
    @InjectRepository(AffiliatePayout)
    private readonly payoutRepo: Repository<AffiliatePayout>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Referral)
    private readonly referralRepo: Repository<Referral>,
    private readonly dataSource: DataSource,
    private readonly notificationService: NotificationService,
  ) {}

  // ---------------------------------------------------------------------------
  // Registration & Profile
  // ---------------------------------------------------------------------------

  /**
   * Register a platform user as an affiliate.
   * Generates a unique tracking link code.
   */
  async registerAffiliate(userId: number): Promise<Affiliate> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const existing = await this.affiliateRepo.findOne({ where: { userId } });
    if (existing) throw new ConflictException('User is already registered as an affiliate');

    const uniqueCode = this.generateUniqueCode(userId);

    const affiliate = this.affiliateRepo.create({
      userId,
      uniqueCode,
      status: AffiliateStatus.PENDING,
      commissionTier: AffiliateCommissionTier.BRONZE,
      commissionRate: COMMISSION_RATES[AffiliateCommissionTier.BRONZE],
      totalEarned: 0,
      pendingPayout: 0,
      totalPaidOut: 0,
      totalReferrals: 0,
      activeReferrals: 0,
      nextPayoutDate: this.nextMonthFirstDay(),
    });

    const saved = await this.affiliateRepo.save(affiliate);
    this.logger.log(`Affiliate registered: userId=${userId}, code=${uniqueCode}`);

    return saved;
  }

  /**
   * Admin: approve or reject an affiliate application.
   */
  async reviewAffiliate(
    affiliateId: number,
    decision: 'approve' | 'reject',
    adminId: number,
    notes?: string,
  ): Promise<Affiliate> {
    const affiliate = await this.affiliateRepo.findOne({ where: { id: affiliateId } });
    if (!affiliate) throw new NotFoundException('Affiliate not found');

    affiliate.status = decision === 'approve' ? AffiliateStatus.APPROVED : AffiliateStatus.REJECTED;
    if (decision === 'approve') affiliate.approvedAt = new Date();
    if (notes) affiliate.notes = notes;

    const saved = await this.affiliateRepo.save(affiliate);

    try {
      const user = await this.userRepo.findOne({ where: { id: affiliate.userId } });
      if (user) {
        await this.notificationService.send({
          userId: affiliate.userId,
          type: 'AFFILIATE_REVIEW',
          channels: [NotificationChannel.Email],
          subject: decision === 'approve'
            ? '🎉 Your affiliate application has been approved!'
            : 'SwapTrade Affiliate Application Update',
          message: decision === 'approve'
            ? `Congratulations! Your affiliate application has been approved.\n\nYour tracking link: ${this.buildTrackingUrl(affiliate.uniqueCode)}\n\nYou earn ${affiliate.commissionRate}% commission on referrals. Happy earning!\n\nThe SwapTrade Team`
            : `Thank you for applying to the SwapTrade affiliate program.\n\nUnfortunately, we were unable to approve your application at this time.${notes ? `\n\nReason: ${notes}` : ''}\n\nYou may reapply after 30 days.\n\nThe SwapTrade Team`,
        });
      }
    } catch (err) {
      this.logger.error(`Failed to send review notification for affiliate ${affiliateId}:`, err);
    }

    this.logger.log(`Affiliate ${affiliateId} ${decision}d by admin ${adminId}`);
    return saved;
  }

  /**
   * Get affiliate profile + tracking link.
   */
  async getAffiliateProfile(userId: number): Promise<{
    affiliate: Affiliate;
    trackingUrl: string;
    tierProgress: object;
  }> {
    const affiliate = await this.affiliateRepo.findOne({
      where: { userId },
      relations: ['user'],
    });
    if (!affiliate) throw new NotFoundException('Affiliate profile not found');

    return {
      affiliate,
      trackingUrl: this.buildTrackingUrl(affiliate.uniqueCode),
      tierProgress: this.buildTierProgress(affiliate),
    };
  }

  // ---------------------------------------------------------------------------
  // Commission Calculation
  // ---------------------------------------------------------------------------

  /**
   * Accrue commission when a referred user completes an action (e.g. trade).
   * Called internally by the trading/settlement service.
   */
  async accrueCommission(
    referredUserId: number,
    tradeFeeAmount: number,
  ): Promise<void> {
    // Find the referral that led this user here
    const referral = await this.referralRepo.findOne({
      where: { referredUserId, status: ReferralStatus.ACTIVE },
    });
    if (!referral) return;

    const affiliate = await this.affiliateRepo.findOne({
      where: { userId: referral.referrerId, status: AffiliateStatus.APPROVED },
    });
    if (!affiliate) return;

    const commission = (tradeFeeAmount * affiliate.commissionRate) / 100;

    // Update affiliate stats atomically
    await this.dataSource.transaction(async (manager) => {
      await manager.update(Affiliate, affiliate.id, {
        totalEarned: () => `total_earned + ${commission}`,
        pendingPayout: () => `pending_payout + ${commission}`,
      });
    });

    // Promote tier if thresholds met
    await this.checkAndPromoteTier(affiliate.id);

    this.logger.log(
      `Commission accrued: affiliateId=${affiliate.id}, amount=${commission}, rate=${affiliate.commissionRate}%`,
    );
  }

  // ---------------------------------------------------------------------------
  // Monthly Payouts
  // ---------------------------------------------------------------------------

  /**
   * Trigger monthly payout for all approved affiliates with pending amounts.
   * Should be called by a scheduled cron job on the 1st of each month.
   */
  async processMonthlyPayouts(): Promise<{ processed: number; totalPaid: number }> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 1);

    const eligible = await this.affiliateRepo.find({
      where: { status: AffiliateStatus.APPROVED },
      relations: ['user'],
    });

    let processed = 0;
    let totalPaid = 0;

    for (const affiliate of eligible) {
      if (Number(affiliate.pendingPayout) <= 0) continue;

      const payoutAmount = Number(affiliate.pendingPayout);

      const payout = this.payoutRepo.create({
        affiliateId: affiliate.id,
        amount: payoutAmount,
        status: AffiliatePayoutStatus.PROCESSING,
        periodStart,
        periodEnd,
      });
      const savedPayout = await this.payoutRepo.save(payout);

      try {
        // In production: integrate with payment processor here
        // For now, we mark it as PAID and update the affiliate record
        await this.dataSource.transaction(async (manager) => {
          await manager.update(AffiliatePayout, savedPayout.id, {
            status: AffiliatePayoutStatus.PAID,
            paidAt: now,
            transactionRef: `PAYOUT-${savedPayout.id}-${Date.now()}`,
          });
          await manager.update(Affiliate, affiliate.id, {
            totalPaidOut: () => `total_paid_out + ${payoutAmount}`,
            pendingPayout: 0,
            nextPayoutDate: this.nextMonthFirstDay(),
          });
        });

        totalPaid += payoutAmount;
        processed++;

        // Notify affiliate
        try {
          await this.notificationService.send({
            userId: affiliate.userId,
            type: 'AFFILIATE_PAYOUT',
            channels: [NotificationChannel.Email],
            subject: `💰 Your affiliate payout of $${payoutAmount.toFixed(2)} has been processed`,
            message: `Hi ${affiliate.user?.username ?? 'there'},\n\nYour affiliate commission payout of $${payoutAmount.toFixed(2)} for the period ${periodStart.toDateString()} – ${periodEnd.toDateString()} has been processed.\n\nYour next payout date: ${this.nextMonthFirstDay().toDateString()}\n\nThank you for being a SwapTrade affiliate!\n\nThe SwapTrade Team`,
          });
        } catch (err) {
          this.logger.error(`Failed to send payout notification to affiliate ${affiliate.id}:`, err);
        }
      } catch (err) {
        this.logger.error(`Payout failed for affiliate ${affiliate.id}:`, err);
        await this.payoutRepo.update(savedPayout.id, {
          status: AffiliatePayoutStatus.FAILED,
          failureReason: String(err?.message ?? 'Unknown error'),
        });
      }
    }

    this.logger.log(`Monthly payouts: processed=${processed}, totalPaid=$${totalPaid.toFixed(2)}`);
    return { processed, totalPaid };
  }

  /**
   * Get payout history for an affiliate.
   */
  async getPayoutHistory(userId: number, page = 1, limit = 20) {
    const affiliate = await this.affiliateRepo.findOne({ where: { userId } });
    if (!affiliate) throw new NotFoundException('Affiliate not found');

    const [data, total] = await this.payoutRepo.findAndCount({
      where: { affiliateId: affiliate.id },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ---------------------------------------------------------------------------
  // Reporting
  // ---------------------------------------------------------------------------

  /**
   * Commission report for admin — all affiliates with earnings breakdown.
   */
  async getCommissionReport(from?: string, to?: string, page = 1, limit = 20) {
    const qb = this.affiliateRepo.createQueryBuilder('a')
      .leftJoinAndSelect('a.user', 'u')
      .where('a.status = :status', { status: AffiliateStatus.APPROVED })
      .orderBy('a.totalEarned', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [affiliates, total] = await qb.getManyAndCount();

    return {
      data: affiliates.map((a) => ({
        affiliateId: a.id,
        userId: a.userId,
        username: a.user?.username ?? 'Unknown',
        commissionTier: a.commissionTier,
        commissionRate: a.commissionRate,
        totalEarned: Number(a.totalEarned),
        pendingPayout: Number(a.pendingPayout),
        totalPaidOut: Number(a.totalPaidOut),
        totalReferrals: a.totalReferrals,
        activeReferrals: a.activeReferrals,
        trackingUrl: this.buildTrackingUrl(a.uniqueCode),
        nextPayoutDate: a.nextPayoutDate,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * List all affiliates (admin view).
   */
  async listAffiliates(status?: AffiliateStatus, page = 1, limit = 20) {
    const where = status ? { status } : {};
    const [data, total] = await this.affiliateRepo.findAndCount({
      where,
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private generateUniqueCode(userId: number): string {
    const randomPart = crypto.randomBytes(6).toString('hex').toUpperCase();
    return `AFF-${userId}-${randomPart}`;
  }

  private buildTrackingUrl(code: string): string {
    const base = process.env.APP_URL ?? 'https://swaptrade.io';
    return `${base}/register?ref=${code}`;
  }

  private nextMonthFirstDay(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  private buildTierProgress(affiliate: Affiliate): object {
    const tiers = Object.values(AffiliateCommissionTier);
    const currentIndex = tiers.indexOf(affiliate.commissionTier);
    const nextTier = tiers[currentIndex + 1];
    const nextThreshold = nextTier ? TIER_THRESHOLDS[nextTier] : null;

    return {
      currentTier: affiliate.commissionTier,
      currentRate: `${affiliate.commissionRate}%`,
      nextTier: nextTier ?? 'MAX',
      nextThreshold,
      progress: nextThreshold
        ? `${affiliate.activeReferrals}/${nextThreshold} active referrals`
        : 'Maximum tier reached',
    };
  }

  private async checkAndPromoteTier(affiliateId: number): Promise<void> {
    const affiliate = await this.affiliateRepo.findOne({ where: { id: affiliateId } });
    if (!affiliate || affiliate.commissionTier === AffiliateCommissionTier.PLATINUM) return;

    const active = await this.referralRepo.count({
      where: { referrerId: affiliate.userId, status: ReferralStatus.ACTIVE },
    });

    let newTier = affiliate.commissionTier;

    if (active >= TIER_THRESHOLDS[AffiliateCommissionTier.PLATINUM]) {
      newTier = AffiliateCommissionTier.PLATINUM;
    } else if (active >= TIER_THRESHOLDS[AffiliateCommissionTier.GOLD]) {
      newTier = AffiliateCommissionTier.GOLD;
    } else if (active >= TIER_THRESHOLDS[AffiliateCommissionTier.SILVER]) {
      newTier = AffiliateCommissionTier.SILVER;
    }

    if (newTier !== affiliate.commissionTier) {
      await this.affiliateRepo.update(affiliateId, {
        commissionTier: newTier,
        commissionRate: COMMISSION_RATES[newTier],
        activeReferrals: active,
      });
      this.logger.log(`Affiliate ${affiliateId} promoted to ${newTier} tier (${COMMISSION_RATES[newTier]}%)`);
    }
  }
}

import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ReferralCode } from './entities/referral-code.entity';
import { Referral, ReferralStatus } from './entities/referral.entity';
import { ReferralReward, RewardType } from './entities/referral-reward.entity';
import { User } from '../user/entities/user.entity';
import * as QRCode from 'qrcode';

@Injectable()
export class ReferralCodeService {
  private readonly logger = new Logger(ReferralCodeService.name);
  private readonly baseUrl = process.env.APP_URL || 'http://localhost:3000';

  constructor(
    @InjectRepository(ReferralCode)
    private readonly referralCodeRepo: Repository<ReferralCode>,
    @InjectRepository(Referral)
    private readonly referralRepo: Repository<Referral>,
    @InjectRepository(ReferralReward)
    private readonly rewardRepo: Repository<ReferralReward>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Generate a unique referral code for a user
   */
  async generateCode(userId: number, forceRegenerate = false): Promise<ReferralCode> {
    // Check if user exists
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Check for existing active code
    const existingCode = await this.referralCodeRepo.findOne({
      where: { userId, isActive: true },
    });

    if (existingCode && !forceRegenerate) {
      return existingCode;
    }

    // If force regenerating, deactivate old code
    if (existingCode && forceRegenerate) {
      existingCode.isActive = false;
      await this.referralCodeRepo.save(existingCode);
    }

    // Generate unique code
    const code = await this.createUniqueCode(userId);

    // Set expiration (90 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    const referralCode = this.referralCodeRepo.create({
      userId,
      code,
      expiresAt,
      isActive: true,
    });

    return this.referralCodeRepo.save(referralCode);
  }

  /**
   * Get user's current referral code
   */
  async getUserCode(userId: number): Promise<ReferralCode | null> {
    return this.referralCodeRepo.findOne({
      where: { userId, isActive: true },
      relations: ['user'],
    });
  }

  /**
   * Get referral code by code string
   */
  async getCodeByString(code: string): Promise<ReferralCode | null> {
    return this.referralCodeRepo.findOne({
      where: { code, isActive: true },
      relations: ['user'],
    });
  }

  /**
   * Generate QR code for referral link
   */
  async generateQRCode(referralCode: string): Promise<string> {
    const referralLink = `${this.baseUrl}/signup?ref=${referralCode}`;
    
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(referralLink, {
        width: 400,
        margin: 2,
        errorCorrectionLevel: 'M',
      });
      
      return qrCodeDataUrl;
    } catch (error) {
      this.logger.error('Failed to generate QR code:', error);
      throw new BadRequestException('Failed to generate QR code');
    }
  }

  /**
   * Track a new referral
   */
  async trackReferral(
    referrerId: number,
    referredUserId: number,
    referralCode: string,
  ): Promise<Referral> {
    // Validate referral code
    const code = await this.getCodeByString(referralCode);
    if (!code) {
      throw new NotFoundException('Invalid referral code');
    }

    if (code.userId !== referrerId) {
      throw new BadRequestException('Referral code does not match referrer');
    }

    // Check for self-referral
    if (referrerId === referredUserId) {
      throw new BadRequestException('Self-referral is not allowed');
    }

    // Check for duplicate referral
    const existing = await this.referralRepo.findOne({
      where: { referredUserId },
    });

    if (existing) {
      throw new ConflictException('User already has a referral attribution');
    }

    const referral = this.referralRepo.create({
      referrerId,
      referredUserId,
      status: ReferralStatus.PENDING,
    });

    return this.referralRepo.save(referral);
  }

  /**
   * Award reward for successful referral
   */
  async awardReward(
    referralId: number,
    amount: number,
    type: RewardType,
    description?: string,
  ): Promise<ReferralReward> {
    const referral = await this.referralRepo.findOne({
      where: { id: referralId },
    });

    if (!referral) {
      throw new NotFoundException('Referral not found');
    }

    const reward = this.rewardRepo.create({
      referralId,
      amount,
      type,
      description,
      creditedAt: new Date(),
    });

    // Update referral status
    referral.status = ReferralStatus.REWARDED;
    referral.rewardedAt = new Date();

    await Promise.all([
      this.referralRepo.save(referral),
      this.rewardRepo.save(reward),
    ]);

    return reward;
  }

  /**
   * Get referral statistics for a user
   */
  async getReferralStats(userId: number): Promise<{
    totalReferrals: number;
    pendingReferrals: number;
    rewardedReferrals: number;
    totalRewards: number;
  }> {
    const [totalReferrals, pendingReferrals, rewardedReferrals] = await Promise.all([
      this.referralRepo.count({ where: { referrerId: userId } }),
      this.referralRepo.count({ where: { referrerId: userId, status: ReferralStatus.PENDING } }),
      this.referralRepo.count({ where: { referrerId: userId, status: ReferralStatus.REWARDED } }),
    ]);

    const rewards = await this.rewardRepo
      .createQueryBuilder('reward')
      .innerJoin('referral', 'referral', 'referral.id = reward.referralId')
      .where('referral.referrerId = :userId', { userId })
      .getRawAndEntities();

    const totalRewards = rewards.entities.reduce((sum, reward) => sum + Number(reward.amount), 0);

    return {
      totalReferrals,
      pendingReferrals,
      rewardedReferrals,
      totalRewards,
    };
  }

  /**
   * Create a unique referral code
   */
  private async createUniqueCode(userId: number): Promise<string> {
    const baseCode = this.generateRandomCode(8);
    let code = baseCode;
    let attempts = 0;

    while (attempts < 10) {
      const existing = await this.referralCodeRepo.findOne({ where: { code } });
      if (!existing) {
        return code;
      }
      code = baseCode + this.generateRandomCode(2);
      attempts++;
    }

    throw new ConflictException('Failed to generate unique referral code');
  }

  /**
   * Generate random alphanumeric code
   */
  private generateRandomCode(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

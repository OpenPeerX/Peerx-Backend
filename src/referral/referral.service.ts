import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Referral, ReferralStatus } from './entities/referral.entity';
import { User } from '../user/entities/user.entity';
import { NotificationService } from '../notification/notification.service';
import {
  ReferralQueryDto,
  ReferralEntryDto,
  ReferralDashboardResponseDto,
  GenerateReferralCodeResponseDto,
} from './dto/referral.dto';

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);
  private readonly BASE_URL = 'https://swaptrade.com/register';

  constructor(
    private notificationService: NotificationService,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Referral)
    private referralRepo: Repository<Referral>,
  ) {}

  /**
   * Generate a unique referral code for a user
   */
  async generateReferralCode(userId: number): Promise<GenerateReferralCodeResponseDto> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Check if user already has a referral code
    const existingReferrals = await this.referralRepo.find({
      where: { referrerId: userId },
      order: { createdAt: 'ASC' },
      take: 1,
    });

    if (existingReferrals.length > 0 && existingReferrals[0].referralCode) {
      return {
        referralCode: existingReferrals[0].referralCode,
        referralLink: `${this.BASE_URL}?ref=${existingReferrals[0].referralCode}`,
      };
    }

    // Generate a unique referral code
    const referralCode = this.generateUniqueCode(user.username);

    // Create a referral record with the generated code
    const referral = this.referralRepo.create({
      referrerId: userId,
      referralCode,
      status: ReferralStatus.PENDING,
      pendingReward: 0,
      earnedReward: 0,
    });

    await this.referralRepo.save(referral);

    this.logger.log(`Generated referral code ${referralCode} for user ${userId}`);

    return {
      referralCode,
      referralLink: `${this.BASE_URL}?ref=${referralCode}`,
    };
  }

  /**
   * Get user's referral dashboard data
   */
  async getReferralDashboard(
    userId: number,
    query: ReferralQueryDto,
  ): Promise<ReferralDashboardResponseDto> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Get or create referral code for the user
    const referralCodeResult = await this.generateReferralCode(userId);

    // Build query for referrals
    const whereConditions: any = { referrerId: userId };
    if (query.status) {
      whereConditions.status = query.status;
    }

    // Get total count
    const total = await this.referralRepo.count({ where: whereConditions });

    // Get paginated referrals
    const referrals = await this.referralRepo.find({
      where: whereConditions,
      order: { createdAt: 'DESC' },
      take: query.limit || 50,
      skip: query.offset || 0,
      relations: ['referredUser'],
    });

    // Calculate totals
    const allReferrals = await this.referralRepo.find({ where: { referrerId: userId } });
    const pendingRewards = allReferrals.reduce(
      (sum, ref) => sum + (ref.status === ReferralStatus.PENDING ? Number(ref.pendingReward) : 0),
      0,
    );
    const earnedRewards = allReferrals.reduce(
      (sum, ref) => sum + Number(ref.earnedReward),
      0,
    );

    // Map to DTO
    const referralEntries: ReferralEntryDto[] = referrals.map((ref) => ({
      id: ref.id,
      referredUserUsername: ref.referredUserUsername || ref.referredUser?.username || 'Unknown',
      referredUserEmail: this.maskEmail(ref.referredUserEmail || ref.referredUser?.email || ''),
      status: ref.status,
      pendingReward: Number(ref.pendingReward),
      earnedReward: Number(ref.earnedReward),
      referredAt: ref.referredAt ? ref.referredAt.toISOString() : ref.createdAt.toISOString(),
      rewardedAt: ref.rewardedAt ? ref.rewardedAt.toISOString() : undefined,
    }));

    const limit = query.limit || 50;
    const offset = query.offset || 0;

    return {
      referralCode: referralCodeResult.referralCode,
      referralLink: referralCodeResult.referralLink,
      totalReferrals: total,
      pendingRewards,
      earnedRewards,
      referrals: referralEntries,
      total,
      limit,
      offset,
      hasMore: offset + referrals.length < total,
    };
  }

  /**
   * Get referral history with pagination
   */
  async getReferralHistory(
    userId: number,
    query: ReferralQueryDto,
  ): Promise<{
    data: ReferralEntryDto[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const whereConditions: any = { referrerId: userId };
    if (query.status) {
      whereConditions.status = query.status;
    }

    const total = await this.referralRepo.count({ where: whereConditions });

    const referrals = await this.referralRepo.find({
      where: whereConditions,
      order: { createdAt: 'DESC' },
      take: query.limit || 50,
      skip: query.offset || 0,
      relations: ['referredUser'],
    });

    const referralEntries: ReferralEntryDto[] = referrals.map((ref) => ({
      id: ref.id,
      referredUserUsername: ref.referredUserUsername || ref.referredUser?.username || 'Unknown',
      referredUserEmail: this.maskEmail(ref.referredUserEmail || ref.referredUser?.email || ''),
      status: ref.status,
      pendingReward: Number(ref.pendingReward),
      earnedReward: Number(ref.earnedReward),
      referredAt: ref.referredAt ? ref.referredAt.toISOString() : ref.createdAt.toISOString(),
      rewardedAt: ref.rewardedAt ? ref.rewardedAt.toISOString() : undefined,
    }));

    const limit = query.limit || 50;
    const offset = query.offset || 0;

    return {
      data: referralEntries,
      total,
      limit,
      offset,
      hasMore: offset + referrals.length < total,
    };
  }

  /**
   * Handle a new referral
   */
  async handleReferral(referrerId: number, referredUserId: number): Promise<Referral> {
    const referrer = await this.userRepo.findOne({ where: { id: referrerId } });
    const referredUser = await this.userRepo.findOne({ where: { id: referredUserId } });

    if (!referrer || !referredUser) {
      throw new NotFoundException('User not found');
    }

    // Check if this referral already exists
    const existingReferral = await this.referralRepo.findOne({
      where: { referredUserId },
    });

    if (existingReferral) {
      this.logger.warn(`Referral for user ${referredUserId} already exists`);
      return existingReferral;
    }

    // Get or create referral code
    const codeResult = await this.generateReferralCode(referrerId);

    // Create the referral
    const referral = this.referralRepo.create({
      referrerId,
      referredUserId,
      referralCode: codeResult.referralCode,
      referredUserEmail: referredUser.email,
      referredUserUsername: referredUser.username,
      status: ReferralStatus.PENDING,
      referredAt: new Date(),
      pendingReward: 0,
      earnedReward: 0,
    });

    const savedReferral = await this.referralRepo.save(referral);

    this.logger.log(`New referral created: ${referrerId} -> ${referredUserId}`);

    return savedReferral;
  }

  /**
   * Credit reward to a referrer
   */
  async creditReward(referralId: number, amount: number): Promise<Referral> {
    const referral = await this.referralRepo.findOne({ where: { id: referralId } });

    if (!referral) {
      throw new NotFoundException(`Referral with ID ${referralId} not found`);
    }

    // Update the referral
    if (referral.status === ReferralStatus.PENDING) {
      referral.status = ReferralStatus.COMPLETED;
      referral.pendingReward = 0;
      referral.earnedReward = amount;
    } else if (referral.status === ReferralStatus.COMPLETED) {
      referral.earnedReward += amount;
    }

    referral.rewardedAt = new Date();

    const savedReferral = await this.referralRepo.save(referral);

    this.logger.log(`Reward ${amount} credited to referral ${referralId}`);

    return savedReferral;
  }

  /**
   * Get referral statistics for a user
   */
  async getReferralStats(userId: number): Promise<{
    totalReferrals: number;
    pendingReferrals: number;
    completedReferrals: number;
    rewardedReferrals: number;
    totalPendingReward: number;
    totalEarnedReward: number;
  }> {
    const referrals = await this.referralRepo.find({ where: { referrerId: userId } });

    return {
      totalReferrals: referrals.length,
      pendingReferrals: referrals.filter((r) => r.status === ReferralStatus.PENDING).length,
      completedReferrals: referrals.filter((r) => r.status === ReferralStatus.COMPLETED).length,
      rewardedReferrals: referrals.filter((r) => r.status === ReferralStatus.REWARDED).length,
      totalPendingReward: referrals.reduce((sum, r) => sum + Number(r.pendingReward), 0),
      totalEarnedReward: referrals.reduce((sum, r) => sum + Number(r.earnedReward), 0),
    };
  }

  /**
   * Validate a referral code
   */
  async validateReferralCode(code: string): Promise<{ valid: boolean; referrerId?: number }> {
    const referral = await this.referralRepo.findOne({
      where: { referralCode: code },
    });

    if (!referral) {
      return { valid: false };
    }

    return { valid: true, referrerId: referral.referrerId };
  }

  /**
   * Generate a unique referral code
   */
  private generateUniqueCode(username: string): string {
    const prefix = username.substring(0, 3).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `REF${prefix}${random}`;
  }

  /**
   * Mask email for privacy
   */
  private maskEmail(email: string): string {
    if (!email || !email.includes('@')) return email;

    const [local, domain] = email.split('@');
    if (local.length <= 2) {
      return `${local[0]}***@${domain}`;
    }

    return `${local.substring(0, 2)}***@${domain}`;
  }
}

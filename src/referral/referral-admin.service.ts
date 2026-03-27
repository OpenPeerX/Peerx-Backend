import { Injectable, NotFoundException, BadRequestException, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like, FindOptionsWhere, ILike } from 'typeorm';
import { Referral, ReferralStatus } from './entities/referral.entity';
import { ReferralConfig } from './entities/referral-config.entity';
import { ReferralDispute } from './entities/referral-dispute.entity';
import { User } from '../user/entities/user.entity';
import { NotificationService } from '../notification/notification.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditEventType, AuditSeverity } from '../common/security/audit-log.entity';
import { SendNotificationDto } from '../notification/dto/send-notification.dto';
import {
  AdminReferralQueryDto,
  AdminReferralEntryDto,
  AdminReferralListResponseDto,
  ReferralStatsDto,
  ReferralLeaderboardResponseDto,
  ManualRewardAdjustmentDto,
  BulkRewardAdjustmentDto,
  FraudDetectionQueryDto,
  FraudFlagDto,
  FraudFlagsResponseDto,
  CreateDisputeDto,
  ResolveDisputeDto,
  DisputeStatus,
  ReferralConfigDto,
} from './dto/referral-admin.dto';

@Injectable()
export class ReferralAdminService {
  private readonly logger = new Logger(ReferralAdminService.name);

  // In-memory config store for simplicity (could be persisted to DB)
  private config: ReferralConfig = {
    id: 1,
    defaultRewardAmount: 10.0,
    minTradesRequired: 5,
    minTradeVolume: 100,
    enabled: true,
    rewardExpiryDays: 30,
    maxBonusMultiplier: 0.05,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  constructor(
    @InjectRepository(Referral)
    private readonly referralRepo: Repository<Referral>,
    @InjectRepository(ReferralConfig)
    private readonly configRepo: Repository<ReferralConfig>,
    @InjectRepository(ReferralDispute)
    private readonly disputeRepo: Repository<ReferralDispute>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly auditLogService: AuditLogService,
    private readonly notificationService: NotificationService,
  ) {}

  // ============================================
  // Configuration Management
  // ============================================

  async getConfig(): Promise<ReferralConfig> {
    return this.config;
  }

  async updateConfig(configDto: ReferralConfigDto, adminId: string): Promise<ReferralConfig> {
    const previousConfig = { ...this.config };
    
    // Update config
    if (configDto.defaultRewardAmount !== undefined) {
      this.config.defaultRewardAmount = configDto.defaultRewardAmount;
    }
    if (configDto.minTradesRequired !== undefined) {
      this.config.minTradesRequired = configDto.minTradesRequired;
    }
    if (configDto.minTradeVolume !== undefined) {
      this.config.minTradeVolume = configDto.minTradeVolume;
    }
    if (configDto.enabled !== undefined) {
      this.config.enabled = configDto.enabled;
    }
    if (configDto.rewardExpiryDays !== undefined) {
      this.config.rewardExpiryDays = configDto.rewardExpiryDays;
    }
    if (configDto.maxBonusMultiplier !== undefined) {
      this.config.maxBonusMultiplier = configDto.maxBonusMultiplier;
    }
    this.config.updatedAt = new Date();

    // Log audit
    await this.auditLogService.log({
      userId: adminId,
      eventType: AuditEventType.REFERRAL_CONFIG_UPDATED,
      entityType: 'REFERRAL_CONFIG',
      entityId: '1',
      severity: AuditSeverity.INFO,
      beforeState: previousConfig,
      afterState: { ...this.config },
      metadata: { action: 'UPDATE_CONFIG' },
    });

    this.logger.log(`Referral config updated by admin ${adminId}`);
    return this.config;
  }

  // ============================================
  // Referral Management
  // ============================================

  async getAllReferrals(
    query: AdminReferralQueryDto,
  ): Promise<AdminReferralListResponseDto> {
    const whereConditions: FindOptionsWhere<Referral> = {};

    if (query.status) {
      whereConditions.status = query.status;
    }
    if (query.referrerId) {
      whereConditions.referrerId = query.referrerId;
    }
    if (query.referredUserId) {
      whereConditions.referredUserId = query.referredUserId;
    }
    if (query.referralCode) {
      whereConditions.referralCode = query.referralCode;
    }

    let dateFilter = {};
    if (query.startDate && query.endDate) {
      dateFilter = {
        createdAt: Between(new Date(query.startDate), new Date(query.endDate)),
      };
    }

    const total = await this.referralRepo.count({
      where: { ...whereConditions, ...dateFilter },
    });

    const referrals = await this.referralRepo.find({
      where: { ...whereConditions, ...dateFilter },
      relations: ['referrer', 'referredUser'],
      order: { [query.sortBy || 'createdAt']: query.sortOrder || 'DESC' },
      take: query.limit || 50,
      skip: query.offset || 0,
    });

    const data: AdminReferralEntryDto[] = referrals.map((ref) => ({
      id: ref.id,
      referrerId: ref.referrerId,
      referrerUsername: ref.referrer?.username || ref.referredUserUsername || 'Unknown',
      referredUserId: ref.referredUserId,
      referredUserUsername: ref.referredUserUsername || ref.referredUser?.username || 'Unknown',
      referralCode: ref.referralCode,
      status: ref.status,
      pendingReward: Number(ref.pendingReward),
      earnedReward: Number(ref.earnedReward),
      referredAt: ref.referredAt ? ref.referredAt.toISOString() : ref.createdAt.toISOString(),
      rewardedAt: ref.rewardedAt ? ref.rewardedAt.toISOString() : undefined,
      createdAt: ref.createdAt.toISOString(),
      updatedAt: ref.updatedAt.toISOString(),
    }));

    const limit = query.limit || 50;
    const offset = query.offset || 0;

    return {
      data,
      total,
      limit,
      offset,
      hasMore: offset + referrals.length < total,
    };
  }

  async getReferralById(referralId: number): Promise<AdminReferralEntryDto> {
    const referral = await this.referralRepo.findOne({
      where: { id: referralId },
      relations: ['referrer', 'referredUser'],
    });

    if (!referral) {
      throw new NotFoundException(`Referral with ID ${referralId} not found`);
    }

    return {
      id: referral.id,
      referrerId: referral.referrerId,
      referrerUsername: referral.referrer?.username || referral.referredUserUsername || 'Unknown',
      referredUserId: referral.referredUserId,
      referredUserUsername: referral.referredUserUsername || referral.referredUser?.username || 'Unknown',
      referralCode: referral.referralCode,
      status: referral.status,
      pendingReward: Number(referral.pendingReward),
      earnedReward: Number(referral.earnedReward),
      referredAt: referral.referredAt ? referral.referredAt.toISOString() : referral.createdAt.toISOString(),
      rewardedAt: referral.rewardedAt ? referral.rewardedAt.toISOString() : undefined,
      createdAt: referral.createdAt.toISOString(),
      updatedAt: referral.updatedAt.toISOString(),
    };
  }

  // ============================================
  // Statistics & Analytics
  // ============================================

  async getSystemStats(): Promise<ReferralStatsDto> {
    const allReferrals = await this.referralRepo.find();

    const totalReferrals = allReferrals.length;
    const pendingReferrals = allReferrals.filter((r) => r.status === ReferralStatus.PENDING).length;
    const completedReferrals = allReferrals.filter((r) => r.status === ReferralStatus.COMPLETED).length;
    const rewardedReferrals = allReferrals.filter((r) => r.status === ReferralStatus.REWARDED).length;
    const cancelledReferrals = allReferrals.filter((r) => r.status === ReferralStatus.CANCELLED).length;

    const totalPendingReward = allReferrals.reduce((sum, r) => sum + Number(r.pendingReward), 0);
    const totalEarnedReward = allReferrals.reduce((sum, r) => sum + Number(r.earnedReward), 0);

    const averageRewardPerReferral = totalReferrals > 0 ? totalEarnedReward / totalReferrals : 0;
    // Conversion rate: completed + rewarded / total
    const conversionRate = totalReferrals > 0 ? ((completedReferrals + rewardedReferrals) / totalReferrals) * 100 : 0;

    return {
      totalReferrals,
      pendingReferrals,
      completedReferrals,
      rewardedReferrals,
      cancelledReferrals,
      totalPendingReward,
      totalEarnedReward,
      averageRewardPerReferral,
      conversionRate,
    };
  }

  // ============================================
  // Manual Reward Adjustments
  // ============================================

  async adjustReward(
    adjustmentDto: ManualRewardAdjustmentDto,
    adminId: string,
  ): Promise<AdminReferralEntryDto> {
    const referral = await this.referralRepo.findOne({
      where: { id: adjustmentDto.referralId },
    });

    if (!referral) {
      throw new NotFoundException(`Referral with ID ${adjustmentDto.referralId} not found`);
    }

    const previousReward = Number(referral.earnedReward);

    // Update the reward
    referral.earnedReward = adjustmentDto.newRewardAmount;
    referral.status = ReferralStatus.REWARDED;
    referral.rewardedAt = new Date();

    await this.referralRepo.save(referral);

    // Log audit
    await this.auditLogService.log({
      userId: adminId,
      eventType: AuditEventType.REFERRAL_REWARD_ADJUSTED,
      entityType: 'REFERRAL',
      entityId: String(referral.id),
      severity: AuditSeverity.WARNING,
      beforeState: { earnedReward: previousReward },
      afterState: { earnedReward: adjustmentDto.newRewardAmount, reason: adjustmentDto.reason },
      metadata: { action: 'MANUAL_REWARD_ADJUSTMENT' },
    });

    // Notify user
    await this.notificationService.sendEvent(referral.referrerId, 'REFERRAL_REWARD_ADJUSTED', `Your referral reward has been manually adjusted. New amount: ${adjustmentDto.newRewardAmount}`);

    this.logger.log(`Reward adjusted for referral ${adjustmentDto.referralId} by admin ${adminId}: ${previousReward} -> ${adjustmentDto.newRewardAmount}`);

    return this.getReferralById(referral.id);
  }

  async bulkAdjustReward(
    bulkDto: BulkRewardAdjustmentDto,
    adminId: string,
  ): Promise<{ updatedCount: number }> {
    const referrals = await this.referralRepo.findByIds(bulkDto.referralIds);

    if (referrals.length === 0) {
      throw new BadRequestException('No valid referrals found');
    }

    let updatedCount = 0;
    for (const referral of referrals) {
      referral.earnedReward = bulkDto.newRewardAmount;
      referral.status = ReferralStatus.REWARDED;
      referral.rewardedAt = new Date();
      await this.referralRepo.save(referral);
      updatedCount++;
    }

    // Log audit
    await this.auditLogService.log({
      userId: adminId,
      eventType: AuditEventType.REFERRAL_BULK_ADJUSTED,
      entityType: 'REFERRAL',
      entityId: 'BULK',
      severity: AuditSeverity.WARNING,
      beforeState: { count: bulkDto.referralIds.length },
      afterState: { updatedCount, newReward: bulkDto.newRewardAmount, reason: bulkDto.reason },
      metadata: { action: 'BULK_REWARD_ADJUSTMENT', referralIds: bulkDto.referralIds },
    });

    this.logger.log(`Bulk reward adjustment by admin ${adminId}: ${updatedCount} referrals updated to ${bulkDto.newRewardAmount}`);

    return { updatedCount };
  }

  // ============================================
  // Fraud Detection
  // ============================================

  async detectFraud(
    query: FraudDetectionQueryDto,
  ): Promise<FraudFlagsResponseDto> {
    const referrals = await this.referralRepo.find({
      relations: ['referrer'],
      order: { createdAt: 'DESC' },
    });

    // Group referrals by IP or other suspicious patterns
    const suspiciousPatterns = new Map<string, number[]>();
    const flaggedReferrals: Referral[] = [];

    for (const referral of referrals) {
      // Check for rapid referrals (same referrer in short time window)
      const key = `referrer_${referral.referrerId}`;
      if (!suspiciousPatterns.has(key)) {
        suspiciousPatterns.set(key, []);
      }
      const times = suspiciousPatterns.get(key)!;
      times.push(referral.createdAt.getTime());
    }

    // Find patterns
    for (const [key, times] of suspiciousPatterns) {
      if (times.length >= (query.minReferralCount || 10)) {
        // Sort times
        times.sort((a, b) => a - b);
        
        // Check for multiple referrals within time window
        for (let i = 0; i < times.length - 1; i++) {
          const diff = times[i + 1] - times[i];
          const windowMs = (query.timeWindowMinutes || 5) * 60 * 1000;
          
          if (diff < windowMs) {
            // Flag as suspicious - find the referral
            const referrerId = parseInt(key.replace('referrer_', ''));
            const flagged = referrals.find(
              (r) => r.referrerId === referrerId && r.createdAt.getTime() === times[i]
            );
            if (flagged && !flaggedReferrals.includes(flagged)) {
              flaggedReferrals.push(flagged);
            }
          }
        }
      }
    }

    const data = flaggedReferrals.map((ref) => ({
      id: ref.id,
      referrerId: ref.referrerId,
      referrerUsername: ref.referrer?.username || 'Unknown',
      referredUserId: ref.referredUserId,
      referredUserUsername: ref.referredUserUsername || 'Unknown',
      referralCode: ref.referralCode,
      status: ref.status,
      pendingReward: Number(ref.pendingReward),
      earnedReward: Number(ref.earnedReward),
      referredAt: ref.referredAt ? ref.referredAt.toISOString() : ref.createdAt.toISOString(),
      rewardedAt: ref.rewardedAt ? ref.rewardedAt.toISOString() : undefined,
      createdAt: ref.createdAt.toISOString(),
      updatedAt: ref.updatedAt.toISOString(),
    }));

    return {
      flaggedReferrals: data,
      totalFlagged: data.length,
      suspicious: data.length, // Simplified for now
      confirmedFraud: 0,
      cleared: 0,
    };
  }

  async flagReferral(
    flagDto: FraudFlagDto,
    adminId: string,
  ): Promise<{ success: boolean; message: string }> {
    const referral = await this.referralRepo.findOne({
      where: { id: flagDto.referralId },
    });

    if (!referral) {
      throw new NotFoundException(`Referral with ID ${flagDto.referralId} not found`);
    }

    // Update status based on flag type
    if (flagDto.flagType === 'CONFIRMED_FRAUD') {
      referral.status = ReferralStatus.CANCELLED;
    } else if (flagDto.flagType === 'CLEARED') {
      // Keep current status if cleared
    }

    await this.referralRepo.save(referral);

    // Log audit
    await this.auditLogService.log({
      userId: adminId,
      eventType: AuditEventType.REFERRAL_FLAGGED,
      entityType: 'REFERRAL',
      entityId: String(referral.id),
      severity: flagDto.flagType === 'CONFIRMED_FRAUD' ? AuditSeverity.CRITICAL : AuditSeverity.WARNING,
      metadata: { flagType: flagDto.flagType, reason: flagDto.reason },
    });

    // Notify user if fraud confirmed
    if (flagDto.flagType === 'CONFIRMED_FRAUD') {
      await this.notificationService.sendEvent(referral.referrerId, 'REFERRAL_FLAGGED', 'Your referral has been flagged for fraudulent activity and has been cancelled.');
    }

    this.logger.log(`Referral ${flagDto.referralId} flagged as ${flagDto.flagType} by admin ${adminId}`);

    return { success: true, message: `Referral flagged as ${flagDto.flagType}` };
  }

  // ============================================
  // Dispute Management
  // ============================================

  async createDispute(disputeDto: CreateDisputeDto): Promise<ReferralDispute> {
    const referral = await this.referralRepo.findOne({
      where: { id: disputeDto.referralId },
    });

    if (!referral) {
      throw new NotFoundException(`Referral with ID ${disputeDto.referralId} not found`);
    }

    const dispute = this.disputeRepo.create({
      referralId: disputeDto.referralId,
      userId: referral.referrerId,
      reason: disputeDto.reason,
      description: disputeDto.description,
      status: DisputeStatus.PENDING,
    });

    return this.disputeRepo.save(dispute);
  }

  async getAllDisputes(status?: DisputeStatus): Promise<ReferralDispute[]> {
    const where = status ? { status } : {};
    return this.disputeRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async resolveDispute(
    resolveDto: ResolveDisputeDto,
    adminId: string,
  ): Promise<ReferralDispute> {
    const dispute = await this.disputeRepo.findOne({
      where: { id: resolveDto.disputeId },
    });

    if (!dispute) {
      throw new NotFoundException(`Dispute with ID ${resolveDto.disputeId} not found`);
    }

    // Update dispute
    dispute.status = resolveDto.resolution === 'RESOLVED' ? DisputeStatus.RESOLVED : DisputeStatus.REJECTED;
    dispute.resolution = resolveDto.notes;
    dispute.resolvedAt = new Date();
    dispute.compensationAmount = resolveDto.compensationAmount || null;

    const savedDispute = await this.disputeRepo.save(dispute);

    // If resolved with compensation, update the referral
    if (resolveDto.resolution === 'RESOLVED' && resolveDto.compensationAmount) {
      const referral = await this.referralRepo.findOne({
        where: { id: dispute.referralId },
      });
      if (referral) {
        referral.earnedReward = Number(referral.earnedReward) + resolveDto.compensationAmount;
        referral.status = ReferralStatus.REWARDED;
        await this.referralRepo.save(referral);
      }
    }

    // Log audit
    await this.auditLogService.log({
      userId: adminId,
      eventType: AuditEventType.REFERRAL_DISPUTE_RESOLVED,
      entityType: 'REFERRAL_DISPUTE',
      entityId: String(dispute.id),
      severity: AuditSeverity.INFO,
      metadata: { 
        resolution: resolveDto.resolution, 
        compensation: resolveDto.compensationAmount,
        notes: resolveDto.notes,
      },
    });

    // Notify user
    await this.notificationService.sendEvent(dispute.userId, 'DISPUTE_RESOLVED', `Your referral dispute has been ${resolveDto.resolution.toLowerCase()}. ${resolveDto.notes}`);

    this.logger.log(`Dispute ${resolveDto.disputeId} resolved by admin ${adminId}: ${resolveDto.resolution}`);

    return savedDispute;
  }

  // ============================================
  // Status Management
  // ============================================

  async changeStatus(
    referralId: number,
    newStatus: ReferralStatus,
    adminId: string,
    reason?: string,
  ): Promise<AdminReferralEntryDto> {
    const referral = await this.referralRepo.findOne({
      where: { id: referralId },
    });

    if (!referral) {
      throw new NotFoundException(`Referral with ID ${referralId} not found`);
    }

    const previousStatus = referral.status;
    referral.status = newStatus;

    if (newStatus === ReferralStatus.REWARDED && !referral.rewardedAt) {
      referral.rewardedAt = new Date();
    }

    await this.referralRepo.save(referral);

    // Log audit
    await this.auditLogService.log({
      userId: adminId,
      eventType: AuditEventType.REFERRAL_STATUS_CHANGED,
      entityType: 'REFERRAL',
      entityId: String(referral.id),
      severity: AuditSeverity.INFO,
      beforeState: { status: previousStatus },
      afterState: { status: newStatus, reason },
    });

    this.logger.log(`Referral ${referralId} status changed from ${previousStatus} to ${newStatus} by admin ${adminId}`);

    return this.getReferralById(referralId);
  }
}
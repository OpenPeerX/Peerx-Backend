import {
  IsString,
  IsNumber,
  IsOptional,
  IsISO8601,
  IsEnum,
  IsBoolean,
  Min,
  Max,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReferralStatus } from '../entities/referral.entity';

// ============================================
// Referral Configuration DTOs
// ============================================

export class ReferralConfigDto {
  @ApiPropertyOptional({ example: 10.0, description: 'Default reward amount per referral' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultRewardAmount?: number;

  @ApiPropertyOptional({ example: 5, description: 'Minimum trades required to qualify for reward' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minTradesRequired?: number;

  @ApiPropertyOptional({ example: 100, description: 'Minimum trade volume required in USD' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minTradeVolume?: number;

  @ApiPropertyOptional({ example: true, description: 'Whether referral system is enabled' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ example: 30, description: 'Reward expiry days' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  rewardExpiryDays?: number;

  @ApiPropertyOptional({ example: 0.05, description: 'Maximum bonus multiplier' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxBonusMultiplier?: number;
}

export class ReferralConfig {
  @ApiProperty({ example: 1 })
  @IsNumber()
  id: number;

  @ApiProperty({ example: 10.0 })
  @IsNumber()
  defaultRewardAmount: number;

  @ApiProperty({ example: 5 })
  @IsNumber()
  minTradesRequired: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  minTradeVolume: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ example: 30 })
  @IsNumber()
  rewardExpiryDays: number;

  @ApiProperty({ example: 0.05 })
  @IsNumber()
  maxBonusMultiplier: number;

  @ApiProperty()
  @IsISO8601()
  createdAt: Date;

  @ApiProperty()
  @IsISO8601()
  updatedAt: Date;
}

export class ReferralConfigResponseDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  id: number;

  @ApiProperty({ example: 10.0 })
  @IsNumber()
  defaultRewardAmount: number;

  @ApiProperty({ example: 5 })
  @IsNumber()
  minTradesRequired: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  minTradeVolume: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ example: 30 })
  @IsNumber()
  rewardExpiryDays: number;

  @ApiProperty({ example: 0.05 })
  @IsNumber()
  maxBonusMultiplier: number;

  @ApiProperty()
  @IsISO8601()
  createdAt: Date;

  @ApiProperty()
  @IsISO8601()
  updatedAt: Date;
}

// ============================================
// Admin Referral Query DTOs
// ============================================

export class AdminReferralQueryDto {
  @ApiPropertyOptional({ description: 'Filter by referral status', enum: ReferralStatus })
  @IsOptional()
  @IsEnum(ReferralStatus)
  status?: ReferralStatus;

  @ApiPropertyOptional({ description: 'Filter by referrer ID' })
  @IsOptional()
  @IsNumber()
  referrerId?: number;

  @ApiPropertyOptional({ description: 'Filter by referred user ID' })
  @IsOptional()
  @IsNumber()
  referredUserId?: number;

  @ApiPropertyOptional({ description: 'Filter by referral code' })
  @IsOptional()
  @IsString()
  referralCode?: string;

  @ApiPropertyOptional({ example: '2024-01-01', description: 'Filter by start date' })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({ example: '2024-12-31', description: 'Filter by end date' })
  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @ApiPropertyOptional({ example: 50, description: 'Results per page (default: 50, max: 100)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({ example: 0, description: 'Pagination offset (default: 0)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({ example: 'createdAt', description: 'Sort field' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ example: 'DESC', description: 'Sort order' })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

// ============================================
// Admin Referral Entry DTO
// ============================================

export class AdminReferralEntryDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  id: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  referrerId: number;

  @ApiProperty({ example: 'johndoe123' })
  @IsString()
  referrerUsername: string;

  @ApiProperty({ example: 200 })
  @IsNumber()
  referredUserId: number;

  @ApiProperty({ example: 'newuser456' })
  @IsString()
  referredUserUsername: string;

  @ApiProperty({ example: 'REFJOHN123' })
  @IsString()
  referralCode: string;

  @ApiProperty({ enum: ReferralStatus })
  @IsEnum(ReferralStatus)
  status: ReferralStatus;

  @ApiProperty({ example: 10.0 })
  @IsNumber()
  pendingReward: number;

  @ApiProperty({ example: 0.0 })
  @IsNumber()
  earnedReward: number;

  @ApiProperty()
  @IsISO8601()
  referredAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  rewardedAt?: string;

  @ApiProperty()
  @IsISO8601()
  createdAt: string;

  @ApiProperty()
  @IsISO8601()
  updatedAt: string;
}

// ============================================
// Paginated Response DTO
// ============================================

export class AdminReferralListResponseDto {
  @ApiProperty({ type: [AdminReferralEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminReferralEntryDto)
  data: AdminReferralEntryDto[];

  @ApiProperty({ example: 100 })
  @IsNumber()
  total: number;

  @ApiProperty({ example: 50 })
  @IsNumber()
  limit: number;

  @ApiProperty({ example: 0 })
  @IsNumber()
  offset: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  hasMore: boolean;
}

// ============================================
// Statistics DTOs
// ============================================

export class ReferralStatsDto {
  @ApiProperty({ example: 500 })
  @IsNumber()
  totalReferrals: number;

  @ApiProperty({ example: 200 })
  @IsNumber()
  pendingReferrals: number;

  @ApiProperty({ example: 150 })
  @IsNumber()
  completedReferrals: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  rewardedReferrals: number;

  @ApiProperty({ example: 50 })
  @IsNumber()
  cancelledReferrals: number;

  @ApiProperty({ example: 2500.0 })
  @IsNumber()
  totalPendingReward: number;

  @ApiProperty({ example: 5000.0 })
  @IsNumber()
  totalEarnedReward: number;

  @ApiProperty({ example: 75.5 })
  @IsNumber()
  averageRewardPerReferral: number;

  @ApiProperty({ example: 25.0 })
  @IsNumber()
  conversionRate: number;
}

export class ReferralLeaderboardEntryDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  rank: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  userId: number;

  @ApiProperty({ example: 'topreferrer' })
  @IsString()
  username: string;

  @ApiProperty({ example: 50 })
  @IsNumber()
  totalReferrals: number;

  @ApiProperty({ example: 500.0 })
  @IsNumber()
  totalEarnedReward: number;
}

export class ReferralLeaderboardResponseDto {
  @ApiProperty({ type: [ReferralLeaderboardEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReferralLeaderboardEntryDto)
  data: ReferralLeaderboardEntryDto[];

  @ApiProperty({ example: 100 })
  @IsNumber()
  totalUsers: number;
}

// ============================================
// Manual Reward Adjustment DTOs
// ============================================

export class ManualRewardAdjustmentDto {
  @ApiProperty({ example: 1, description: 'Referral ID' })
  @IsNumber()
  referralId: number;

  @ApiProperty({ example: 50.0, description: 'New reward amount' })
  @IsNumber()
  @Min(0)
  newRewardAmount: number;

  @ApiProperty({ example: 'Bonus for high-value referral', description: 'Reason for adjustment' })
  @IsString()
  reason: string;
}

export class BulkRewardAdjustmentDto {
  @ApiProperty({ type: [Number], description: 'Array of referral IDs' })
  @IsArray()
  @IsNumber({}, { each: true })
  referralIds: number[];

  @ApiProperty({ example: 25.0, description: 'New reward amount for all' })
  @IsNumber()
  @Min(0)
  newRewardAmount: number;

  @ApiProperty({ example: 'Seasonal bonus', description: 'Reason for bulk adjustment' })
  @IsString()
  reason: string;
}

// ============================================
// Fraud Detection DTOs
// ============================================

export class FraudDetectionQueryDto {
  @ApiPropertyOptional({ example: 10, description: 'Minimum referral count to flag' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minReferralCount?: number = 10;

  @ApiPropertyOptional({ example: 5, description: 'Minimum time window in minutes' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  timeWindowMinutes?: number = 5;

  @ApiPropertyOptional({ example: true, description: 'Include already flagged referrals' })
  @IsOptional()
  @IsBoolean()
  includeFlagged?: boolean = false;
}

export class FraudFlagDto {
  @ApiProperty({ example: 1, description: 'Referral ID to flag' })
  @IsNumber()
  referralId: number;

  @ApiProperty({ example: 'Suspicious pattern detected', description: 'Reason for flagging' })
  @IsString()
  reason: string;

  @ApiProperty({ enum: ['SUSPICIOUS', 'CONFIRMED_FRAUD', 'CLEARED'] })
  @IsEnum(['SUSPICIOUS', 'CONFIRMED_FRAUD', 'CLEARED'])
  flagType: 'SUSPICIOUS' | 'CONFIRMED_FRAUD' | 'CLEARED';
}

export class FraudFlagsResponseDto {
  @ApiProperty({ type: [AdminReferralEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminReferralEntryDto)
  flaggedReferrals: AdminReferralEntryDto[];

  @ApiProperty({ example: 15 })
  @IsNumber()
  totalFlagged: number;

  @ApiProperty({ example: 10 })
  @IsNumber()
  suspicious: number;

  @ApiProperty({ example: 3 })
  @IsNumber()
  confirmedFraud: number;

  @ApiProperty({ example: 2 })
  @IsNumber()
  cleared: number;
}

// ============================================
// Dispute Resolution DTOs
// ============================================

export enum DisputeStatus {
  PENDING = 'PENDING',
  IN_REVIEW = 'IN_REVIEW',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
}

export class CreateDisputeDto {
  @ApiProperty({ example: 1, description: 'Referral ID' })
  @IsNumber()
  referralId: number;

  @ApiProperty({ example: 'Reward not credited', description: 'Dispute reason' })
  @IsString()
  reason: string;

  @ApiProperty({ example: 'I completed all requirements but never received my reward', description: 'Detailed description' })
  @IsString()
  description: string;
}

export class ResolveDisputeDto {
  @ApiProperty({ example: 1, description: 'Dispute ID' })
  @IsNumber()
  disputeId: number;

  @ApiProperty({ enum: ['RESOLVED', 'REJECTED'] })
  @IsEnum(['RESOLVED', 'REJECTED'])
  resolution: 'RESOLVED' | 'REJECTED';

  @ApiProperty({ example: 'Reward has been credited to your account', description: 'Resolution notes' })
  @IsString()
  notes: string;

  @ApiPropertyOptional({ example: 25.0, description: 'Compensation amount if applicable' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  compensationAmount?: number;
}

// ============================================
// Audit Log DTO
// ============================================

export class AdminActionAuditDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  id: string;

  @ApiProperty({ example: 'ADMIN_REWARD_ADJUSTMENT' })
  @IsString()
  eventType: string;

  @ApiProperty({ example: 'REFERRAL' })
  @IsString()
  entityType: string;

  @ApiProperty({ example: '1' })
  @IsString()
  entityId: string;

  @ApiProperty()
  @IsISO8601()
  createdAt: string;

  @ApiProperty()
  @IsString()
  adminId: string;

  @ApiProperty()
  @IsString()
  metadata: string;
}

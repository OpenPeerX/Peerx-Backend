import { IsString, IsNumber, IsOptional, IsISO8601, Max, Min, IsBoolean, ArrayMinSize, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReferralStatus } from '../entities/referral.entity';

export class ReferralQueryDto {
  @ApiPropertyOptional({ example: 'PENDING', description: 'Filter by referral status', enum: ReferralStatus })
  @IsOptional()
  @IsEnum(ReferralStatus)
  status?: ReferralStatus;

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
}

export class ReferralEntryDto {
  @ApiProperty({ example: 1, description: 'Referral ID' })
  @IsNumber()
  id: number;

  @ApiProperty({ example: 'johndoe123', description: 'Referred user username' })
  @IsString()
  referredUserUsername: string;

  @ApiProperty({ example: 'john@example.com', description: 'Referred user email' })
  @IsString()
  referredUserEmail: string;

  @ApiProperty({ example: ReferralStatus.PENDING, description: 'Referral status', enum: ReferralStatus })
  @IsEnum(ReferralStatus)
  status: ReferralStatus;

  @ApiProperty({ example: 10.50, description: 'Pending reward amount' })
  @IsNumber()
  pendingReward: number;

  @ApiProperty({ example: 0, description: 'Earned reward amount' })
  @IsNumber()
  earnedReward: number;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z', description: 'When the user was referred' })
  @IsISO8601()
  referredAt: string;

  @ApiPropertyOptional({ example: '2024-01-20T10:30:00.000Z', description: 'When the reward was credited' })
  @IsOptional()
  @IsISO8601()
  rewardedAt?: string;
}

export class ReferralDashboardResponseDto {
  @ApiProperty({ description: 'User referral code', example: 'REF123XYZ' })
  @IsString()
  referralCode: string;

  @ApiProperty({ description: 'Shareable referral link', example: 'https://swaptrade.com/register?ref=REF123XYZ' })
  @IsString()
  referralLink: string;

  @ApiProperty({ example: 5, description: 'Total number of referrals' })
  @IsNumber()
  totalReferrals: number;

  @ApiProperty({ example: 25.50, description: 'Total pending rewards' })
  @IsNumber()
  pendingRewards: number;

  @ApiProperty({ example: 100.00, description: 'Total earned rewards' })
  @IsNumber()
  earnedRewards: number;

  @ApiProperty({ type: [ReferralEntryDto], description: 'Referral history entries' })
  @ArrayMinSize(0)
  referrals: ReferralEntryDto[];

  @ApiProperty({ example: 10, description: 'Total number of referrals matching filters' })
  @IsNumber()
  total: number;

  @ApiProperty({ example: 50, description: 'Number of entries returned per page' })
  @IsNumber()
  limit: number;

  @ApiProperty({ example: 0, description: 'Number of entries skipped' })
  @IsNumber()
  offset: number;

  @ApiProperty({ example: true, description: 'Whether more entries are available' })
  @IsBoolean()
  hasMore: boolean;
}

export class GenerateReferralCodeResponseDto {
  @ApiProperty({ description: 'Generated referral code', example: 'REF123XYZ' })
  @IsString()
  referralCode: string;

  @ApiProperty({ description: 'Shareable referral link', example: 'https://swaptrade.com/register?ref=REF123XYZ' })
  @IsString()
  referralLink: string;
}
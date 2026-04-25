import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Req, 
  HttpCode, 
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ReferralService } from './referral.service';
import { ReferralCodeService } from './referral-code.service';
import { RewardType } from './entities/referral-reward.entity';
import { IsString, IsUUID, IsNotEmpty, IsOptional, IsBoolean, IsNumber } from 'class-validator';

class ReferralCallbackDto {
  @IsUUID() refereeId: string;
  @IsString() @IsNotEmpty() referrerCode: string;
}

class GenerateReferralCodeDto {
  @IsOptional()
  @IsBoolean()
  forceRegenerate?: boolean;
}

class SignupWithReferralDto {
  @IsNumber() referrerId: number;
  @IsNumber() referredUserId: number;
  @IsString() @IsNotEmpty() referralCode: string;
}

@Controller('api/referrals')
export class ReferralController {
  constructor(
    private readonly referralService: ReferralService,
    private readonly referralCodeService: ReferralCodeService,
  ) {}

  // POST /api/referrals/generate-code - Generate new referral code
  @Post('generate-code')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async generateCode(@Body() dto: GenerateReferralCodeDto, @Req() req: any) {
    const userId = req.user?.id || 1;
    
    const referralCode = await this.referralCodeService.generateCode(
      userId,
      dto.forceRegenerate || false,
    );

    const qrCodeUrl = await this.referralCodeService.generateQRCode(referralCode.code);

    return {
      code: referralCode.code,
      createdAt: referralCode.createdAt,
      expiresAt: referralCode.expiresAt,
      isActive: referralCode.isActive,
      qrCodeUrl,
    };
  }

  // GET /api/referrals/my-code - Get user's current referral code
  @Get('my-code')
  async getMyCode(@Req() req: any) {
    const userId = req.user?.id || 1;
    
    const referralCode = await this.referralCodeService.getUserCode(userId);

    if (!referralCode) {
      return { code: null, message: 'No active referral code found' };
    }

    const qrCodeUrl = await this.referralCodeService.generateQRCode(referralCode.code);

    return {
      code: referralCode.code,
      createdAt: referralCode.createdAt,
      expiresAt: referralCode.expiresAt,
      isActive: referralCode.isActive,
      qrCodeUrl,
    };
  }

  // GET /api/referrals/stats - Get referral stats for the authenticated user
  @Get('stats')
  async getStats(@Req() req: any) {
    const userId = req.user?.id || 1;
    return this.referralCodeService.getReferralStats(userId);
  }

  /**
   * POST /api/referrals/signup
   * Track a new referral on user signup and immediately credit the signup bonus reward.
   * Called by the auth/registration flow after a new user signs up with a referral code.
   */
  @Post('signup')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async trackSignupReferral(@Body() dto: SignupWithReferralDto) {
    // 1. Track the referral relationship
    const referral = await this.referralCodeService.trackReferral(
      dto.referrerId,
      dto.referredUserId,
      dto.referralCode,
    );

    // 2. Credit signup bonus reward to the referrer
    const reward = await this.referralCodeService.awardReward(
      referral.id,
      10, // $10 signup bonus
      RewardType.SIGNUP_BONUS,
      `Signup bonus for referring user ${dto.referredUserId}`,
    );

    return {
      success: true,
      referralId: referral.id,
      rewardId: reward.id,
      rewardAmount: reward.amount,
      message: 'Referral tracked and signup bonus credited',
    };
  }

  // POST /api/referrals/waitlist/callback — legacy waitlist referral callback
  @Post('waitlist/callback')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  callback(@Body() dto: ReferralCallbackDto, @Req() req: any) {
    const ip = req.headers['x-forwarded-for'] || req.ip;
    return this.referralService.processReferralCallback(dto.refereeId, dto.referrerCode, ip);
  }
}

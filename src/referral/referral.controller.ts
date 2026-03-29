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
import { IsString, IsUUID, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

class ReferralCallbackDto {
  @IsUUID() refereeId: string;
  @IsString() @IsNotEmpty() referrerCode: string;
}

class GenerateReferralCodeDto {
  @IsOptional()
  @IsBoolean()
  forceRegenerate?: boolean;
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
    // TODO: Add authentication - extract userId from JWT token
    const userId = req.user?.id || 1; // Placeholder until auth is implemented
    
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
    // TODO: Add authentication - extract userId from JWT token
    const userId = req.user?.id || 1; // Placeholder until auth is implemented
    
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

  // #198 POST /api/waitlist/referral/callback
  @Post('waitlist/callback')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  callback(@Body() dto: ReferralCallbackDto, @Req() req: any) {
    const ip = req.headers['x-forwarded-for'] || req.ip;
    return this.referralService.processReferralCallback(dto.refereeId, dto.referrerCode, ip);
  }
}

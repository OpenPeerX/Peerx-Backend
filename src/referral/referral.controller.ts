import { Controller, Post, Body, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ReferralService } from './referral.service';
import { IsString, IsUUID, IsNotEmpty } from 'class-validator';

class ReferralCallbackDto {
  @IsUUID() refereeId: string;
  @IsString() @IsNotEmpty() referrerCode: string;
}

@Controller('api/waitlist/referral')
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  // #198 POST /api/waitlist/referral/callback
  @Post('callback')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  callback(@Body() dto: ReferralCallbackDto, @Req() req: any) {
    const ip = req.headers['x-forwarded-for'] || req.ip;
    return this.referralService.processReferralCallback(dto.refereeId, dto.referrerCode, ip);
  }
}

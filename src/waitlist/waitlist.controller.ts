import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WaitlistService } from './waitlist.service';
import { WaitlistSignupDto, WaitlistVerifyDto } from './dto/waitlist.dto';
import { WaitlistType } from './entities/waitlist-user.entity';

@Controller('api/waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  // -----------------------------------------------------------------------
  // Generic waitlist signup
  // -----------------------------------------------------------------------

  // POST /api/waitlist/signup
  @Post('signup')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async signup(@Body() dto: WaitlistSignupDto) {
    return this.waitlistService.signup(
      dto.email,
      dto.name,
      dto.referralCode,
      dto.referralSource,
      (dto.type as WaitlistType) ?? WaitlistType.PLATFORM,
      dto.targetId,
    );
  }

  // POST /api/waitlist/verify
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(@Body() dto: WaitlistVerifyDto) {
    return this.waitlistService.verifyEmail(dto.email, dto.token);
  }

  // POST /api/waitlist/resend-verification
  @Post('resend-verification')
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  async resendVerification(@Body('email') email: string) {
    return this.waitlistService.resendVerificationEmail(email);
  }

  // -----------------------------------------------------------------------
  // #336 — Premium Feature Waitlist
  // -----------------------------------------------------------------------

  // POST /api/waitlist/premium/join
  @Post('premium/join')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async joinPremium(
    @Body() body: { email: string; featureName: string; tier?: 'basic' | 'pro' | 'enterprise'; name?: string },
  ) {
    return this.waitlistService.joinPremiumWaitlist(
      body.email,
      body.featureName,
      body.tier ?? 'basic',
      body.name,
    );
  }

  // GET /api/waitlist/premium/list
  @Get('premium/list')
  async listPremium(
    @Query('feature') feature?: string,
    @Query('tier') tier?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.waitlistService.listPremiumWaitlist(feature, tier, +page, +limit);
  }

  // PATCH /api/waitlist/premium/:id/unlock
  @Patch('premium/:id/unlock')
  @HttpCode(HttpStatus.OK)
  async unlockPremium(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('adminId') adminId: string,
  ) {
    return this.waitlistService.unlockPremiumAccess(id, adminId);
  }

  // -----------------------------------------------------------------------
  // #333 — Asset Pair Waitlist
  // -----------------------------------------------------------------------

  // POST /api/waitlist/asset-pairs/join
  @Post('asset-pairs/join')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async joinAssetPair(
    @Body() body: { email: string; pairSymbol: string; name?: string },
  ) {
    return this.waitlistService.joinAssetPairWaitlist(body.email, body.pairSymbol, body.name);
  }

  // GET /api/waitlist/asset-pairs/votes
  @Get('asset-pairs/votes')
  async assetPairVotes(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.waitlistService.getAssetPairVoteCounts(+page, +limit);
  }

  // PATCH /api/waitlist/asset-pairs/:pair/launch
  @Patch('asset-pairs/:pair/launch')
  @HttpCode(HttpStatus.OK)
  async launchAssetPair(
    @Param('pair') pair: string,
    @Body('adminId') adminId: string,
  ) {
    return this.waitlistService.markAssetPairLaunched(pair, adminId);
  }

  // -----------------------------------------------------------------------
  // Admin / shared
  // -----------------------------------------------------------------------

  // GET /api/waitlist/list
  @Get('list')
  async list(@Query() query: any) {
    return this.waitlistService.findAll(query);
  }

  // GET /api/waitlist/stats
  @Get('stats')
  async stats() {
    return this.waitlistService.getStats();
  }

  // GET /api/waitlist/leaderboard
  @Get('leaderboard')
  async leaderboard(@Query('limit') limit?: number) {
    return this.waitlistService.getLeaderboard(limit ? +limit : 10);
  }
}

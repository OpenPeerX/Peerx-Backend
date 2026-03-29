import { 
  Controller, 
  Get, 
  Post, 
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

@Controller('api/waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  // POST /api/waitlist/signup - Register for waitlist
  @Post('signup')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async signup(@Body() dto: WaitlistSignupDto) {
    return this.waitlistService.signup(
      dto.email,
      dto.name,
      dto.referralCode,
      dto.referralSource,
    );
  }

  // POST /api/waitlist/verify - Verify email with token
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(@Body() dto: WaitlistVerifyDto) {
    return this.waitlistService.verifyEmail(dto.email, dto.token);
  }

  // POST /api/waitlist/resend-verification - Resend verification email
  @Post('resend-verification')
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 times per hour
  async resendVerification(@Body('email') email: string) {
    return this.waitlistService.resendVerificationEmail(email);
  }

  // GET /api/waitlist/list - Admin list (with pagination)
  @Get('list')
  async list(@Query() query: any) {
    return this.waitlistService.findAll(query);
  }

  // GET /api/waitlist/stats - Get waitlist statistics
  @Get('stats')
  async stats() {
    return this.waitlistService.getStats();
  }

  // GET /api/waitlist/leaderboard - Get referral leaderboard
  @Get('leaderboard')
  async leaderboard(@Query('limit') limit?: number) {
    return this.waitlistService.getLeaderboard(limit ? +limit : 10);
  }
}

import { Controller, Get, Post, Body, Query, Param, ParseUUIDPipe } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WaitlistService } from './waitlist.service';

@Controller('api/waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  // #199 GET /api/waitlist/leaderboard
  @Get('leaderboard')
  getLeaderboard(@Query('limit') limit?: number) {
    return this.waitlistService.getLeaderboard(limit ? +limit : 10);
  }
}

import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import {
  ReferralServiceExtended,
  TradingMetric,
} from './referral.service.extended';

@ApiTags('Leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly referralService: ReferralServiceExtended) {}

  /**
   * GET /leaderboard/referrals?period=weekly&page=1&pageSize=20
   */
  @Get('referrals')
  @ApiOperation({
    summary: 'Referral leaderboard ranked by successful referrals',
  })
  @ApiQuery({
    name: 'period',
    enum: ['weekly', 'monthly', 'all-time'],
    required: false,
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  async getReferralLeaderboard(
    @Query('period') period: string = 'all-time',
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    if (!['weekly', 'monthly', 'all-time'].includes(period)) {
      throw new BadRequestException(
        'period must be weekly | monthly | all-time',
      );
    }
    if (pageSize > 100) throw new BadRequestException('pageSize max is 100');

    return this.referralService.getReferralLeaderboard(
      period as any,
      page,
      pageSize,
    );
  }

  /**
   * GET /leaderboard/trading?period=weekly&metric=volume&page=1&pageSize=20
   */
  @Get('trading')
  @ApiOperation({
    summary: 'Trading leaderboard ranked by volume, profit, or trade count',
  })
  @ApiQuery({
    name: 'period',
    enum: ['daily', 'weekly', 'monthly'],
    required: false,
  })
  @ApiQuery({
    name: 'metric',
    enum: ['volume', 'profit', 'count'],
    required: false,
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  async getTradingLeaderboard(
    @Query('period') period: string = 'weekly',
    @Query('metric') metric: string = 'volume',
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    if (!['daily', 'weekly', 'monthly'].includes(period)) {
      throw new BadRequestException('period must be daily | weekly | monthly');
    }
    if (!['volume', 'profit', 'count'].includes(metric)) {
      throw new BadRequestException('metric must be volume | profit | count');
    }
    if (pageSize > 100) throw new BadRequestException('pageSize max is 100');

    return this.referralService.getTradingLeaderboard(
      period as any,
      metric as TradingMetric,
      page,
      pageSize,
    );
  }
}

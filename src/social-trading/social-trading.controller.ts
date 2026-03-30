import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { SocialTradingService } from './social-trading.service';
import { UpsertTraderProfileDto } from './dto/upsert-trader-profile.dto';
import { CreateSharedStrategyDto } from './dto/create-shared-strategy.dto';
import { FollowTraderDto } from './dto/follow-trader.dto';
import { ConfigureCopyTradingDto } from './dto/configure-copy-trading.dto';
import { AddStrategyCommentDto } from './dto/add-strategy-comment.dto';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';

@ApiTags('social-trading')
@Controller('social-trading')
export class SocialTradingController {
  constructor(private readonly socialTradingService: SocialTradingService) {}

  @Post('profiles/:userId')
  @ApiOperation({ summary: 'Create or update a trader profile' })
  @ApiParam({ name: 'userId', description: 'Trader user id' })
  async upsertTraderProfile(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpsertTraderProfileDto,
  ) {
    return this.socialTradingService.upsertTraderProfile(userId, dto);
  }

  @Get('profiles/:userId')
  @ApiOperation({ summary: 'Get a trader profile and performance metrics' })
  async getTraderProfile(@Param('userId', ParseIntPipe) userId: number) {
    return this.socialTradingService.getTraderProfile(userId);
  }

  @Post('strategies')
  @ApiOperation({ summary: 'Share a trader strategy for followers to discover' })
  async createSharedStrategy(@Body() dto: CreateSharedStrategyDto) {
    return this.socialTradingService.createSharedStrategy(dto);
  }

  @Get('strategies/:strategyId')
  @ApiOperation({ summary: 'Get a shared strategy with comments, likes, and analytics' })
  async getStrategy(@Param('strategyId', ParseIntPipe) strategyId: number) {
    return this.socialTradingService.getStrategy(strategyId);
  }

  @Get('strategies/trader/:traderId')
  @ApiOperation({ summary: 'List the strategies published by a trader' })
  async getTraderStrategies(@Param('traderId', ParseIntPipe) traderId: number) {
    return this.socialTradingService.getTraderStrategies(traderId);
  }

  @Post('follows')
  @ApiOperation({ summary: 'Follow a trader' })
  async followTrader(@Body() dto: FollowTraderDto) {
    return this.socialTradingService.followTrader(dto);
  }

  @Post('copy-relationships')
  @ApiOperation({ summary: 'Configure automated trade copying with customizable risk settings' })
  async configureCopyTrading(@Body() dto: ConfigureCopyTradingDto) {
    return this.socialTradingService.configureCopyTrading(dto);
  }

  @Get('copy-relationships/follower/:followerId')
  @ApiOperation({ summary: 'List copy-trading relationships for a follower' })
  async getCopyRelationshipsForFollower(
    @Param('followerId', ParseIntPipe) followerId: number,
  ) {
    return this.socialTradingService.getCopyRelationshipsForFollower(followerId);
  }

  @Post('strategies/:strategyId/comments')
  @ApiOperation({ summary: 'Comment on a shared strategy' })
  async addStrategyComment(
    @Param('strategyId', ParseIntPipe) strategyId: number,
    @Body() dto: AddStrategyCommentDto,
  ) {
    return this.socialTradingService.addStrategyComment(strategyId, dto);
  }

  @Post('strategies/:strategyId/likes/:userId')
  @ApiOperation({ summary: 'Toggle like for a strategy' })
  async toggleStrategyLike(
    @Param('strategyId', ParseIntPipe) strategyId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.socialTradingService.toggleStrategyLike(strategyId, userId);
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Get the trader leaderboard ranked by social-trading performance' })
  @ApiQuery({ name: 'ranking', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getLeaderboard(@Query() query: LeaderboardQueryDto) {
    return this.socialTradingService.getLeaderboard(query.ranking, query.limit);
  }

  @Get('analytics/:traderId')
  @ApiOperation({ summary: 'Get social trading performance analytics and reporting' })
  async getPerformanceAnalytics(@Param('traderId', ParseIntPipe) traderId: number) {
    return this.socialTradingService.getPerformanceAnalytics(traderId);
  }

  @Post('revenue-sharing/distribute')
  @ApiOperation({ summary: 'Calculate and persist revenue sharing for top performers' })
  async distributeRevenueShares(@Query('period') period?: string) {
    return this.socialTradingService.distributeRevenueShares(period);
  }
}
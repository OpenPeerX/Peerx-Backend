import { Controller, Get, Post, Body, Param, ParseIntPipe, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ReferralService } from './referral.service';
import { ReferralQueryDto, ReferralDashboardResponseDto, GenerateReferralCodeResponseDto } from './dto/referral.dto';
import { ReferralStatus } from './entities/referral.entity';

@ApiTags('referrals')
@Controller('referrals')
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  /**
   * Get user referral dashboard data
   * GET /referrals/dashboard/:userId
   */
  @Get('dashboard/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Get user referral dashboard', 
    description: 'Returns complete referral data including code, stats, and history with pagination' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Referral dashboard data retrieved',
    type: ReferralDashboardResponseDto 
  })
  @ApiParam({ name: 'userId', type: Number, description: 'User ID' })
  @ApiQuery({ name: 'status', required: false, enum: ReferralStatus, description: 'Filter by status' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Results per page (default: 50, max: 100)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Pagination offset (default: 0)' })
  async getReferralDashboard(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: ReferralQueryDto,
  ): Promise<ReferralDashboardResponseDto> {
    return this.referralService.getReferralDashboard(userId, query);
  }

  /**
   * Get referral history with pagination
   * GET /referrals/history/:userId
   */
  @Get('history/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Get user referral history', 
    description: 'Returns paginated referral history entries' 
  })
  @ApiResponse({ status: 200, description: 'Referral history retrieved' })
  @ApiParam({ name: 'userId', type: Number, description: 'User ID' })
  @ApiQuery({ name: 'status', required: false, enum: ReferralStatus, description: 'Filter by status' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Results per page (default: 50, max: 100)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Pagination offset (default: 0)' })
  async getReferralHistory(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: ReferralQueryDto,
  ) {
    return this.referralService.getReferralHistory(userId, query);
  }

  /**
   * Generate or get user's referral code and link
   * GET /referrals/code/:userId
   */
  @Get('code/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Get user referral code', 
    description: 'Returns the user\'s unique referral code and shareable link' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Referral code retrieved',
    type: GenerateReferralCodeResponseDto 
  })
  @ApiParam({ name: 'userId', type: Number, description: 'User ID' })
  async getReferralCode(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<GenerateReferralCodeResponseDto> {
    return this.referralService.generateReferralCode(userId);
  }

  /**
   * Validate a referral code
   * POST /referrals/validate
   */
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Validate referral code', 
    description: 'Validates if a referral code is valid and returns the referrer ID' 
  })
  @ApiResponse({ status: 200, description: 'Validation result' })
  async validateReferralCode(
    @Body() body: { code: string },
  ) {
    return this.referralService.validateReferralCode(body.code);
  }

  /**
   * Get referral statistics for a user
   * GET /referrals/stats/:userId
   */
  @Get('stats/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Get referral statistics', 
    description: 'Returns detailed referral statistics including counts and reward totals' 
  })
  @ApiResponse({ status: 200, description: 'Referral statistics retrieved' })
  @ApiParam({ name: 'userId', type: Number, description: 'User ID' })
  async getReferralStats(
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.referralService.getReferralStats(userId);
  }

  /**
   * Handle a new referral (internal endpoint)
   * POST /referrals/register
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Register a new referral', 
    description: 'Creates a new referral relationship between users' 
  })
  @ApiResponse({ status: 201, description: 'Referral created' })
  async registerReferral(
    @Body() body: { referrerId: number; referredUserId: number },
  ) {
    return this.referralService.handleReferral(body.referrerId, body.referredUserId);
  }

  /**
   * Credit reward to a referral (internal endpoint)
   * POST /referrals/:referralId/reward
   */
  @Post(':referralId/reward')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Credit referral reward', 
    description: 'Credits a reward to the referrer for a completed referral' 
  })
  @ApiResponse({ status: 200, description: 'Reward credited' })
  @ApiParam({ name: 'referralId', type: Number, description: 'Referral ID' })
  async creditReward(
    @Param('referralId', ParseIntPipe) referralId: number,
    @Body() body: { amount: number },
  ) {
    return this.referralService.creditReward(referralId, body.amount);
  }
}
import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ReferralAdminService } from './referral-admin.service';
import {
  AdminReferralQueryDto,
  AdminReferralEntryDto,
  AdminReferralListResponseDto,
  ReferralStatsDto,
  ReferralLeaderboardResponseDto,
  ManualRewardAdjustmentDto,
  BulkRewardAdjustmentDto,
  FraudDetectionQueryDto,
  FraudFlagDto,
  FraudFlagsResponseDto,
  CreateDisputeDto,
  ResolveDisputeDto,
  ReferralConfigDto,
  ReferralConfig,
} from './dto/referral-admin.dto';
import { ReferralStatus } from './entities/referral.entity';
import { DisputeStatus } from './dto/referral-admin.dto';

// Simple guard that checks for admin role
// In a production system, this would use JWT and proper role verification
const AdminGuard = (req: any) => {
  // For now, we'll accept admin ID from header or assume admin for demo
  // In production, verify JWT and check role
  return true;
};

@ApiTags('admin-referrals')
@Controller('admin/referrals')
export class ReferralAdminController {
  constructor(private readonly referralAdminService: ReferralAdminService) {}

  // ============================================
  // Configuration Management
  // ============================================

  /**
   * Get referral system configuration
   * GET /admin/referrals/config
   */
  @Get('config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get referral configuration',
    description: 'Returns the current referral system configuration settings',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration retrieved',
    type: ReferralConfig,
  })
  async getConfig(): Promise<ReferralConfig> {
    return this.referralAdminService.getConfig();
  }

  /**
   * Update referral system configuration
   * PUT /admin/referrals/config
   */
  @Put('config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update referral configuration',
    description: 'Update the referral system configuration settings',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration updated',
    type: ReferralConfig,
  })
  async updateConfig(
    @Body() configDto: ReferralConfigDto,
    @Req() req: any,
  ): Promise<ReferralConfig> {
    const adminId = req.headers['x-admin-id'] || 'system';
    return this.referralAdminService.updateConfig(configDto, adminId);
  }

  // ============================================
  // Referral Management
  // ============================================

  /**
   * Get all referrals with filters
   * GET /admin/referrals
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all referrals',
    description: 'Returns paginated list of all referrals with optional filters',
  })
  @ApiResponse({
    status: 200,
    description: 'Referrals retrieved',
    type: AdminReferralListResponseDto,
  })
  @ApiQuery({ name: 'status', required: false, enum: ReferralStatus, description: 'Filter by status' })
  @ApiQuery({ name: 'referrerId', required: false, type: Number, description: 'Filter by referrer ID' })
  @ApiQuery({ name: 'referredUserId', required: false, type: Number, description: 'Filter by referred user ID' })
  @ApiQuery({ name: 'referralCode', required: false, type: String, description: 'Filter by referral code' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Filter by start date' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Filter by end date' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Results per page' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Pagination offset' })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: 'Sort field' })
  @ApiQuery({ name: 'sortOrder', required: false, type: String, description: 'Sort order' })
  async getAllReferrals(
    @Query() query: AdminReferralQueryDto,
  ): Promise<AdminReferralListResponseDto> {
    return this.referralAdminService.getAllReferrals(query);
  }

  /**
   * Get referral by ID
   * GET /admin/referrals/:id
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get referral by ID',
    description: 'Returns detailed information about a specific referral',
  })
  @ApiResponse({
    status: 200,
    description: 'Referral retrieved',
    type: AdminReferralEntryDto,
  })
  @ApiParam({ name: 'id', type: Number, description: 'Referral ID' })
  async getReferralById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<AdminReferralEntryDto> {
    return this.referralAdminService.getReferralById(id);
  }

  /**
   * Change referral status
   * PUT /admin/referrals/:id/status
   */
  @Put(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change referral status',
    description: 'Manually change the status of a referral',
  })
  @ApiResponse({
    status: 200,
    description: 'Status changed',
    type: AdminReferralEntryDto,
  })
  @ApiParam({ name: 'id', type: Number, description: 'Referral ID' })
  async changeStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: ReferralStatus; reason?: string },
    @Req() req: any,
  ): Promise<AdminReferralEntryDto> {
    const adminId = req.headers['x-admin-id'] || 'system';
    return this.referralAdminService.changeStatus(id, body.status, adminId, body.reason);
  }

  // ============================================
  // Statistics & Analytics
  // ============================================

  /**
   * Get system-wide referral statistics
   * GET /admin/referrals/stats
   */
  @Get('stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get referral statistics',
    description: 'Returns comprehensive statistics about the referral system',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved',
    type: ReferralStatsDto,
  })
  async getStats(): Promise<ReferralStatsDto> {
    return this.referralAdminService.getSystemStats();
  }

  /**
   * Get referral leaderboard
   * GET /admin/referrals/leaderboard
   */
  @Get('leaderboard')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get referral leaderboard',
    description: 'Returns top referrers by referral count',
  })
  @ApiResponse({
    status: 200,
    description: 'Leaderboard retrieved',
    type: ReferralLeaderboardResponseDto,
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of entries (default: 20)' })
  async getLeaderboard(
    @Query('limit') limit?: number,
  ): Promise<ReferralLeaderboardResponseDto> {
    return this.referralAdminService.getLeaderboard(limit || 20);
  }

  // ============================================
  // Manual Reward Adjustments
  // ============================================

  /**
   * Adjust single referral reward
   * POST /admin/referrals/reward/adjust
   */
  @Post('reward/adjust')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Adjust referral reward',
    description: 'Manually adjust the reward amount for a single referral',
  })
  @ApiResponse({ status: 200, description: 'Reward adjusted', type: AdminReferralEntryDto })
  async adjustReward(
    @Body() adjustmentDto: ManualRewardAdjustmentDto,
    @Req() req: any,
  ): Promise<AdminReferralEntryDto> {
    const adminId = req.headers['x-admin-id'] || 'system';
    return this.referralAdminService.adjustReward(adjustmentDto, adminId);
  }

  /**
   * Bulk adjust referral rewards
   * POST /admin/referrals/reward/bulk-adjust
   */
  @Post('reward/bulk-adjust')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bulk adjust referral rewards',
    description: 'Manually adjust the reward amount for multiple referrals at once',
  })
  @ApiResponse({ status: 200, description: 'Bulk adjustment complete' })
  async bulkAdjustReward(
    @Body() bulkDto: BulkRewardAdjustmentDto,
    @Req() req: any,
  ): Promise<{ updatedCount: number }> {
    const adminId = req.headers['x-admin-id'] || 'system';
    return this.referralAdminService.bulkAdjustReward(bulkDto, adminId);
  }

  // ============================================
  // Fraud Detection
  // ============================================

  /**
   * Detect potential fraud
   * GET /admin/referrals/fraud/detect
   */
  @Get('fraud/detect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Detect fraud patterns',
    description: 'Analyze referrals for suspicious patterns that may indicate fraud',
  })
  @ApiResponse({
    status: 200,
    description: 'Fraud detection complete',
    type: FraudFlagsResponseDto,
  })
  @ApiQuery({ name: 'minReferralCount', required: false, type: Number, description: 'Minimum referrals to flag' })
  @ApiQuery({ name: 'timeWindowMinutes', required: false, type: Number, description: 'Time window in minutes' })
  @ApiQuery({ name: 'includeFlagged', required: false, type: Boolean, description: 'Include already flagged' })
  async detectFraud(
    @Query() query: FraudDetectionQueryDto,
  ): Promise<FraudFlagsResponseDto> {
    return this.referralAdminService.detectFraud(query);
  }

  /**
   * Flag a referral for fraud
   * POST /admin/referrals/fraud/flag
   */
  @Post('fraud/flag')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Flag referral for fraud',
    description: 'Mark a referral as suspicious or confirmed fraud',
  })
  @ApiResponse({ status: 200, description: 'Referral flagged' })
  async flagReferral(
    @Body() flagDto: FraudFlagDto,
    @Req() req: any,
  ): Promise<{ success: boolean; message: string }> {
    const adminId = req.headers['x-admin-id'] || 'system';
    return this.referralAdminService.flagReferral(flagDto, adminId);
  }

  // ============================================
  // Dispute Management
  // ============================================

  /**
   * Create a new dispute
   * POST /admin/referrals/disputes
   */
  @Post('disputes')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create referral dispute',
    description: 'Create a new dispute for a referral',
  })
  @ApiResponse({ status: 201, description: 'Dispute created' })
  async createDispute(
    @Body() disputeDto: CreateDisputeDto,
  ) {
    return this.referralAdminService.createDispute(disputeDto);
  }

  /**
   * Get all disputes
   * GET /admin/referrals/disputes
   */
  @Get('disputes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all disputes',
    description: 'Returns all referral disputes, optionally filtered by status',
  })
  @ApiResponse({ status: 200, description: 'Disputes retrieved' })
  @ApiQuery({ name: 'status', required: false, enum: DisputeStatus, description: 'Filter by status' })
  async getAllDisputes(
    @Query('status') status?: DisputeStatus,
  ) {
    return this.referralAdminService.getAllDisputes(status);
  }

  /**
   * Resolve a dispute
   * PUT /admin/referrals/disputes/:id/resolve
   */
  @Put('disputes/:id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resolve dispute',
    description: 'Resolve a referral dispute with optional compensation',
  })
  @ApiResponse({ status: 200, description: 'Dispute resolved' })
  @ApiParam({ name: 'id', type: Number, description: 'Dispute ID' })
  async resolveDispute(
    @Param('id', ParseIntPipe) id: number,
    @Body() resolveDto: ResolveDisputeDto,
    @Req() req: any,
  ) {
    const adminId = req.headers['x-admin-id'] || 'system';
    return this.referralAdminService.resolveDispute({ ...resolveDto, disputeId: id }, adminId);
  }
}
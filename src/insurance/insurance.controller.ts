import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InsuranceFundService } from './services/insurance-fund.service';
import { InsuranceContributionService } from './services/insurance-contribution.service';
import { InsuranceClaimService } from './services/insurance-claim.service';
import { LiquidationCoverageService } from './services/liquidation-coverage.service';
import { FundHealthMonitoringService } from './services/fund-health-monitoring.service';
import { CreateInsuranceFundDto, UpdateInsuranceFundDto } from './dto/insurance-fund.dto';
import { CreateContributionDto } from './dto/insurance-contribution.dto';
import { CreateClaimDto } from './dto/insurance-claim.dto';

@ApiTags('Insurance')
@Controller('insurance')
export class InsuranceController {
  private readonly logger = new Logger(InsuranceController.name);

  constructor(
    private readonly fundService: InsuranceFundService,
    private readonly contributionService: InsuranceContributionService,
    private readonly claimService: InsuranceClaimService,
    private readonly coverageService: LiquidationCoverageService,
    private readonly healthService: FundHealthMonitoringService,
  ) {}

  // ====== FUND MANAGEMENT ENDPOINTS ======

  @Post('fund')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new insurance fund' })
  async createFund(@Body() createDto: CreateInsuranceFundDto) {
    return await this.fundService.createFund(createDto);
  }

  @Get('fund/:fundId')
  @ApiOperation({ summary: 'Get fund by ID' })
  async getFund(@Param('fundId') fundId: number) {
    return await this.fundService.getFundById(fundId);
  }

  @Get('fund/primary')
  @ApiOperation({ summary: 'Get primary insurance fund' })
  async getPrimaryFund() {
    return await this.fundService.getPrimaryFund();
  }

  @Get('funds')
  @ApiOperation({ summary: 'Get all funds' })
  async getAllFunds() {
    return await this.fundService.getAllFunds();
  }

  @Put('fund/:fundId')
  @ApiOperation({ summary: 'Update fund configuration' })
  async updateFund(
    @Param('fundId') fundId: number,
    @Body() updateDto: UpdateInsuranceFundDto,
  ) {
    return await this.fundService.updateFund(fundId, updateDto);
  }

  @Post('fund/:fundId/deposit')
  @ApiOperation({ summary: 'Deposit to fund' })
  async depositToFund(
    @Param('fundId') fundId: number,
    @Body('amount') amount: number,
  ) {
    return await this.fundService.depositToFund(fundId, amount);
  }

  @Post('fund/:fundId/withdraw')
  @ApiOperation({ summary: 'Withdraw from fund' })
  async withdrawFromFund(
    @Param('fundId') fundId: number,
    @Body('amount') amount: number,
  ) {
    return await this.fundService.withdrawFromFund(fundId, amount);
  }

  @Get('fund/:fundId/status')
  @ApiOperation({ summary: 'Get fund status summary' })
  async getFundStatus(@Param('fundId') fundId: number) {
    return await this.fundService.getFundStatus(fundId);
  }

  @Post('fund/:fundId/pause')
  @ApiOperation({ summary: 'Pause fund' })
  async pauseFund(@Param('fundId') fundId: number) {
    return await this.fundService.pauseFund(fundId);
  }

  @Post('fund/:fundId/resume')
  @ApiOperation({ summary: 'Resume fund' })
  async resumeFund(@Param('fundId') fundId: number) {
    return await this.fundService.resumeFund(fundId);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get all funds statistics' })
  async getStatistics() {
    return await this.fundService.getStatistics();
  }

  // ====== CONTRIBUTION ENDPOINTS ======

  @Post('contribution')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record new contribution' })
  async recordContribution(
    @Body() createDto: CreateContributionDto,
  ) {
    return await this.contributionService.recordContribution(
      createDto.fundId,
      createDto,
    );
  }

  @Post('contribution/trade')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record trade-based contribution' })
  async recordTradeContribution(
    @Body() body: {
      fundId: number;
      userId: number;
      tradeId: number;
      tradeVolume: number;
      contributionRate: number;
    },
  ) {
    return await this.contributionService.recordTradeContribution(
      body.fundId,
      body.tradeVolume,
      body.userId,
      body.tradeId,
      body.contributionRate,
    );
  }

  @Post('contribution/manual')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record manual contribution' })
  async recordManualContribution(
    @Body() body: {
      fundId: number;
      userId: number;
      amount: number;
      reason: string;
    },
  ) {
    return await this.contributionService.recordManualContribution(
      body.fundId,
      body.amount,
      body.userId,
      body.reason,
    );
  }

  @Post('contribution/:contributionId/approve')
  @ApiOperation({ summary: 'Approve pending contribution' })
  async approveContribution(@Param('contributionId') contributionId: number) {
    return await this.contributionService.approveContribution(contributionId);
  }

  @Post('contribution/:contributionId/reject')
  @ApiOperation({ summary: 'Reject contribution' })
  async rejectContribution(
    @Param('contributionId') contributionId: number,
    @Body('reason') reason: string,
  ) {
    return await this.contributionService.rejectContribution(
      contributionId,
      reason,
    );
  }

  @Post('fund/:fundId/contributions/batch-approve')
  @ApiOperation({ summary: 'Batch approve pending contributions' })
  async batchApproveFundContributions(@Param('fundId') fundId: number) {
    return await this.contributionService.batchApproveContributions(fundId);
  }

  @Get('fund/:fundId/contributions')
  @ApiOperation({ summary: 'Get fund contributions' })
  async getFundContributions(
    @Param('fundId') fundId: number,
    @Query('status') status?: string,
    @Query('limit') limit: number = 100,
    @Query('offset') offset: number = 0,
  ) {
    return await this.contributionService.getFundContributions(
      fundId,
      status as any,
      limit,
      offset,
    );
  }

  @Get('fund/:fundId/contributions/stats')
  @ApiOperation({ summary: 'Get contribution statistics' })
  async getContributionStats(@Param('fundId') fundId: number) {
    return await this.contributionService.getContributionStats(fundId);
  }

  @Get('user/:userId/contributions/fund/:fundId')
  @ApiOperation({ summary: 'Get user contribution history' })
  async getUserContributions(
    @Param('fundId') fundId: number,
    @Param('userId') userId: number,
  ) {
    return await this.contributionService.getUserContributionHistory(
      fundId,
      userId,
    );
  }

  // ====== CLAIM ENDPOINTS ======

  @Post('claim')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit insurance claim' })
  async submitClaim(
    @Body() createDto: CreateClaimDto,
  ) {
    return await this.claimService.submitClaim(createDto.fundId, createDto);
  }

  @Get('claim/:claimId')
  @ApiOperation({ summary: 'Get claim by ID' })
  async getClaim(@Param('claimId') claimId: number) {
    return await this.claimService.getClaimById(claimId);
  }

  @Post('claim/:claimId/approve')
  @ApiOperation({ summary: 'Approve claim' })
  async approveClaim(
    @Param('claimId') claimId: number,
    @Body() body: { approverUserId: number; notes?: string },
  ) {
    return await this.claimService.approveClaim(
      claimId,
      body.approverUserId,
      body.notes,
    );
  }

  @Post('claim/:claimId/payout')
  @ApiOperation({ summary: 'Process claim payout' })
  async payoutClaim(
    @Param('claimId') claimId: number,
    @Body('operatorId') operatorId: number,
  ) {
    return await this.claimService.payoutClaim(claimId, operatorId);
  }

  @Post('claim/:claimId/reject')
  @ApiOperation({ summary: 'Reject claim' })
  async rejectClaim(
    @Param('claimId') claimId: number,
    @Body() body: { rejector: number; reason: string },
  ) {
    return await this.claimService.rejectClaim(
      claimId,
      body.rejector,
      body.reason,
    );
  }

  @Post('claim/:claimId/cancel')
  @ApiOperation({ summary: 'Cancel claim' })
  async cancelClaim(
    @Param('claimId') claimId: number,
    @Body('reason') reason: string,
  ) {
    return await this.claimService.cancelClaim(claimId, reason);
  }

  @Get('fund/:fundId/claims')
  @ApiOperation({ summary: 'Get fund claims' })
  async getFundClaims(
    @Param('fundId') fundId: number,
    @Query('status') status?: string,
    @Query('limit') limit: number = 100,
    @Query('offset') offset: number = 0,
  ) {
    return await this.claimService.getFundClaims(
      fundId,
      status as any,
      limit,
      offset,
    );
  }

  @Get('fund/:fundId/claims/stats')
  @ApiOperation({ summary: 'Get claim statistics' })
  async getClaimStats(@Param('fundId') fundId: number) {
    return await this.claimService.getClaimStats(fundId);
  }

  @Get('user/:userId/claims/fund/:fundId')
  @ApiOperation({ summary: 'Get user claim history' })
  async getUserClaims(
    @Param('fundId') fundId: number,
    @Param('userId') userId: number,
  ) {
    return await this.claimService.getUserClaimHistory(fundId, userId);
  }

  @Get('fund/:fundId/claims/high-value')
  @ApiOperation({ summary: 'Get high value claims' })
  async getHighValueClaims(
    @Param('fundId') fundId: number,
    @Query('threshold') threshold: number = 1000,
  ) {
    return await this.claimService.getHighValueClaims(fundId, threshold);
  }

  @Post('fund/:fundId/claims/batch-approve')
  @ApiOperation({ summary: 'Batch approve pending claims' })
  async batchApproveClaims(
    @Param('fundId') fundId: number,
    @Body('approverUserId') approverUserId: number,
  ) {
    return await this.claimService.batchApproveClaims(fundId, approverUserId);
  }

  // ====== LIQUIDATION COVERAGE ENDPOINTS ======

  @Post('liquidation/record')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record liquidation event' })
  async recordLiquidation(
    @Body() body: {
      fundId: number;
      userId: number;
      totalLoss: number;
      reason: string;
      metadata?: any;
    },
  ) {
    const result = await this.coverageService.recordLiquidationEvent(
      body.fundId,
      body.userId,
      body.totalLoss,
      body.reason,
      body.metadata,
    );

    this.logger.debug(
      `Liquidation recorded: userId=${body.userId}, loss=${body.totalLoss}, coverage=${result.coverageDecision.coverageAmount}`,
    );

    return result;
  }

  @Get('liquidation/:liquidationId')
  @ApiOperation({ summary: 'Get liquidation event' })
  async getLiquidation(@Param('liquidationId') liquidationId: number) {
    return await this.coverageService.getLiquidationHistory(liquidationId as any, undefined, 1);
  }

  @Post('liquidation/:liquidationId/finalize')
  @ApiOperation({ summary: 'Finalize liquidation' })
  async finalizeLiquidation(
    @Param('liquidationId') liquidationId: number,
    @Body('claimId') claimId?: number,
  ) {
    return await this.coverageService.finalizeLiquidation(
      liquidationId,
      claimId,
    );
  }

  @Get('fund/:fundId/liquidations')
  @ApiOperation({ summary: 'Get liquidation history' })
  async getLiquidationHistory(
    @Param('fundId') fundId: number,
    @Query('status') status?: string,
    @Query('limit') limit: number = 100,
  ) {
    return await this.coverageService.getLiquidationHistory(
      fundId,
      status as any,
      limit,
    );
  }

  @Get('fund/:fundId/cascade-risk')
  @ApiOperation({ summary: 'Get cascade risk assessment' })
  async getCascadeRisk(@Param('fundId') fundId: number) {
    return await this.coverageService.getCascadeRiskMetrics(fundId);
  }

  @Get('fund/:fundId/cascade-imminent')
  @ApiOperation({ summary: 'Check if cascade is imminent' })
  async isCascadeImminent(@Param('fundId') fundId: number) {
    const imminent = await this.coverageService.isCascadeLiquidationImminent(
      fundId,
    );
    return { imminent };
  }

  @Post('fund/:fundId/prevent-cascade')
  @ApiOperation({ summary: 'Manually prevent cascade liquidation' })
  async preventCascade(@Param('fundId') fundId: number) {
    return await this.coverageService.preventCascadeLiquidation(fundId);
  }

  @Get('fund/:fundId/liquidation-patterns')
  @ApiOperation({ summary: 'Analyze liquidation patterns' })
  async analyzeLiquidationPatterns(@Param('fundId') fundId: number) {
    return await this.coverageService.analyzeLiquidationPatterns(fundId);
  }

  @Get('fund/:fundId/failsafe-status')
  @ApiOperation({ summary: 'Get fail-safe status' })
  async getFailSafeStatus(@Param('fundId') fundId: number) {
    return await this.coverageService.getFailSafeStatus(fundId);
  }

  // ====== HEALTH MONITORING ENDPOINTS ======

  @Get('fund/:fundId/health')
  @ApiOperation({ summary: 'Get fund health status' })
  async getHealth(@Param('fundId') fundId: number) {
    return await this.healthService.getHealthStatus(fundId);
  }

  @Get('fund/:fundId/health/report')
  @ApiOperation({ summary: 'Get comprehensive health report' })
  async getHealthReport(@Param('fundId') fundId: number) {
    return await this.healthService.getHealthReport(fundId);
  }

  @Post('fund/:fundId/health/update')
  @ApiOperation({ summary: 'Update health metrics' })
  async updateHealthMetrics(@Param('fundId') fundId: number) {
    return await this.healthService.calculateHealthMetrics(fundId);
  }

  @Get('fund/:fundId/auto-refill')
  @ApiOperation({ summary: 'Check auto-refill status' })
  async checkAutoRefill(@Param('fundId') fundId: number) {
    return await this.healthService.checkAutoRefillNeeded(fundId);
  }

  @Post('fund/:fundId/trigger-auto-refill')
  @ApiOperation({ summary: 'Trigger auto-refill' })
  async triggerAutoRefill(@Param('fundId') fundId: number) {
    return await this.healthService.triggerAutoRefill(fundId);
  }

  @Get('fund/:fundId/alert')
  @ApiOperation({ summary: 'Generate health alert' })
  async getHealthAlert(@Param('fundId') fundId: number) {
    return await this.healthService.generateHealthAlert(fundId);
  }

  @Get('fund/:fundId/anomalies')
  @ApiOperation({ summary: 'Detect anomalies' })
  async detectAnomalies(@Param('fundId') fundId: number) {
    return await this.healthService.detectAnomalies(fundId);
  }

  @Get('health/all')
  @ApiOperation({ summary: 'Get all funds health metrics' })
  async getAllHealthMetrics() {
    return await this.healthService.getAllHealthMetrics();
  }

  @Get('health/critical')
  @ApiOperation({ summary: 'Get funds requiring attention' })
  async getCriticalFunds() {
    return await this.healthService.getFundsRequiringAttention();
  }
}

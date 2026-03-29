import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AlertingService } from './services/alerting.service';
import { PatternDetectionService } from './services/pattern-detection.service';
import { MLInferenceService } from './services/ml-inference.service';
import { ActorThrottlingService } from './services/actor-throttling.service';
import { VisualizationService } from './services/visualization.service';
import { BacktestService } from './services/backtest.service';
import { AnomalyAlert
} from './entities/anomaly-alert.entity';
import * as DTOs from './dto/index';

@Controller('market-surveillance')
@ApiTags('Market Surveillance')
export class MarketSurveillanceController {
  private readonly logger = new Logger(MarketSurveillanceController.name);

  constructor(
    private alertingService: AlertingService,
    private patternDetectionService: PatternDetectionService,
    private mlInferenceService: MLInferenceService,
    private throttlingService: ActorThrottlingService,
    private visualizationService: VisualizationService,
    private backtestService: BacktestService,
  ) {}

  /**
   * ============ ALERT MANAGEMENT ============
   */

  @Get('alerts')
  @ApiOperation({ summary: 'Get all alerts with filtering options' })
  @ApiResponse({ status: 200, description: 'List of alerts' })
  async getAlerts(@Query() filters: DTOs.GetAlertsFilterDto) {
    return await this.alertingService.getAlerts({
      status: filters.status,
      severity: filters.severity,
      actorId: filters.actorId,
      tradingPair: filters.tradingPair,
      limit: filters.limit,
      offset: filters.offset,
    });
  }

  @Get('alerts/stats')
  @ApiOperation({ summary: 'Get alert statistics' })
  @ApiResponse({ status: 200, description: 'Alert statistics' })
  async getAlertStats() {
    return await this.alertingService.getAlertStats();
  }

  @Get('alerts/:alertId')
  @ApiOperation({ summary: 'Get alert by ID' })
  @ApiParam({ name: 'alertId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Alert details' })
  async getAlert(@Param('alertId') alertId: string) {
    // Implementation
    return { message: 'Alert details endpoint' };
  }

  @Post('alerts/:alertId/investigate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start investigation of an alert' })
  @ApiParam({ name: 'alertId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Investigation started' })
  async investigateAlert(
    @Param('alertId') alertId: string,
    @Body() dto: DTOs.InvestigateAlertDto,
  ) {
    return await this.alertingService.investigateAlert(
      alertId,
      dto.investigatorId,
      dto.notes,
    );
  }

  @Post('alerts/:alertId/confirm-violation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm alert as violation' })
  @ApiParam({ name: 'alertId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Violation confirmed' })
  async confirmViolation(
    @Param('alertId') alertId: string,
    @Body() dto: DTOs.ConfirmViolationDto,
  ) {
    return await this.alertingService.confirmViolation(
      alertId,
      dto.investigatorId,
      dto.findings,
    );
  }

  @Post('alerts/:alertId/mark-false-positive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark alert as false positive' })
  @ApiParam({ name: 'alertId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Alert marked as false positive' })
  async markFalsePositive(
    @Param('alertId') alertId: string,
    @Body() dto: DTOs.MarkFalsePositiveDto,
  ) {
    return await this.alertingService.markFalsePositive(alertId, dto.reason);
  }

  @Post('alerts/:alertId/escalate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Escalate alert' })
  @ApiParam({ name: 'alertId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Alert escalated' })
  async escalateAlert(
    @Param('alertId') alertId: string,
    @Body() dto: DTOs.EscalateAlertDto,
  ) {
    return await this.alertingService.escalateAlert(
      alertId,
      dto.newStatus,
      dto.reason,
      dto.escalatedBy,
    );
  }

  @Post('alerts/:alertId/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve alert' })
  @ApiParam({ name: 'alertId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Alert resolved' })
  async resolveAlert(
    @Param('alertId') alertId: string,
    @Body() dto: DTOs.ResolveAlertDto,
  ) {
    return await this.alertingService.resolveAlert(alertId, dto.resolution);
  }

  /**
   * ============ ACTOR THROTTLING ============
   */

  @Post('throttle/check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check if order should be throttled' })
  @ApiResponse({ status: 200, description: 'Throttle status' })
  async checkThrottle(@Body() dto: DTOs.CheckThrottleDto) {
    return await this.throttlingService.checkThrottle(dto);
  }

  @Post('throttle/apply')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply throttle to actor' })
  @ApiResponse({ status: 200, description: 'Throttle applied' })
  async applyThrottle(@Body() dto: DTOs.ApplyThrottleDto) {
    return await this.throttlingService.applyThrottle(
      dto.actorId,
      dto.throttleLevel as any,
      dto.reason,
      dto.durationMinutes,
    );
  }

  @Post('throttle/reduce')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reduce throttle level for actor' })
  @ApiResponse({ status: 200, description: 'Throttle reduced' })
  async reduceThrottle(@Body() dto: DTOs.ReduceThrottleDto) {
    return await this.throttlingService.reduceThrottle(dto.actorId);
  }

  @Get('throttle/:actorId/status')
  @ApiOperation({ summary: 'Get actor throttle status' })
  @ApiParam({ name: 'actorId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Throttle status' })
  async getThrottleStatus(@Param('actorId') actorId: string) {
    return await this.throttlingService.getThrottleStatus(actorId);
  }

  @Get('throttle/stats')
  @ApiOperation({ summary: 'Get throttle statistics' })
  @ApiResponse({ status: 200, description: 'Throttle statistics' })
  async getThrottleStats() {
    return await this.throttlingService.getThrottleStats();
  }

  @Post('throttle/appeal')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit appeal for throttle reduction' })
  @ApiResponse({ status: 201, description: 'Appeal submitted' })
  async submitAppeal(@Body() dto: DTOs.AppealThrottleDto) {
    return await this.throttlingService.submitAppeal(dto);
  }

  @Post('throttle/appeal/:appealId/decide')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Decide on throttle appeal' })
  @ApiParam({ name: 'appealId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Appeal decided' })
  async decideAppeal(
    @Param('appealId') appealId: string,
    @Body() dto: DTOs.DecideAppealDto,
  ) {
    return await this.throttlingService.decideAppeal(
      appealId,
      dto.approved,
      dto.reason,
      dto.decisionMaker,
    );
  }

  /**
   * ============ SUSPICIOUS ACTORS ============
   */

  @Get('actors')
  @ApiOperation({ summary: 'Get suspicious actors with filtering' })
  @ApiResponse({ status: 200, description: 'List of suspicious actors' })
  async getSuspiciousActors(@Query() filters: DTOs.GetActorsFilterDto) {
    // Implementation
    return { message: 'Suspicious actors endpoint' };
  }

  @Get('actors/:actorId')
  @ApiOperation({ summary: 'Get suspicious actor details' })
  @ApiParam({ name: 'actorId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Actor details' })
  async getActor(@Param('actorId') actorId: string) {
    // Implementation
    return { message: 'Actor details endpoint' };
  }

  @Get('actors/:actorId/violations')
  @ApiOperation({ summary: 'Get actor violation history' })
  @ApiParam({ name: 'actorId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Violation history' })
  async getActorViolations(@Param('actorId') actorId: string) {
    // Implementation
    return { message: 'Actor violations endpoint' };
  }

  /**
   * ============ PATTERN DETECTION ============
   */

  @Get('patterns')
  @ApiOperation({ summary: 'Get all detection patterns' })
  @ApiResponse({ status: 200, description: 'List of patterns' })
  async getPatterns() {
    return await this.patternDetectionService.getActiveModels();
  }

  @Post('patterns/:patternId/disable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable a detection pattern' })
  @ApiParam({ name: 'patternId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Pattern disabled' })
  async disablePattern(@Param('patternId') patternId: string) {
    // Implementation
    return { message: 'Pattern disabled' };
  }

  @Post('patterns/:patternId/enable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable a detection pattern' })
  @ApiParam({ name: 'patternId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Pattern enabled' })
  async enablePattern(@Param('patternId') patternId: string) {
    // Implementation
    return { message: 'Pattern enabled' };
  }

  @Put('patterns/:patternId')
  @ApiOperation({ summary: 'Update pattern configuration' })
  @ApiParam({ name: 'patternId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Pattern updated' })
  async updatePattern(
    @Param('patternId') patternId: string,
    @Body() dto: DTOs.UpdatePatternTemplateDto,
  ) {
    // Implementation
    return { message: 'Pattern updated' };
  }

  /**
   * ============ DASHBOARD & VISUALIZATION ============
   */

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard summary' })
  @ApiResponse({ status: 200, description: 'Dashboard data' })
  async getDashboard(@Query() query: DTOs.GetDashboardDto) {
    return await this.visualizationService.getDashboardSummary(query.hoursBack);
  }

  @Get('heatmap/:tradingPair')
  @ApiOperation({ summary: 'Get heatmap data for trading pair' })
  @ApiParam({ name: 'tradingPair', type: 'string' })
  @ApiResponse({ status: 200, description: 'Heatmap data' })
  async getHeatmap(@Param('tradingPair') tradingPair: string, @Query() query: DTOs.GetHeatmapDto) {
    return await this.visualizationService.generateHeatmap(
      tradingPair,
      query.hoursBack,
      query.interval,
    );
  }

  @Get('anomaly-distribution')
  @ApiOperation({ summary: 'Get anomaly type distribution' })
  @ApiResponse({ status: 200, description: 'Anomaly distribution' })
  async getAnomalyDistribution(@Query('hoursBack') hoursBack: number = 24) {
    return await this.visualizationService.getAnomalyDistribution(hoursBack);
  }

  @Get('severity-distribution')
  @ApiOperation({ summary: 'Get severity distribution' })
  @ApiResponse({ status: 200, description: 'Severity distribution' })
  async getSeverityDistribution(@Query('hoursBack') hoursBack: number = 24) {
    return await this.visualizationService.getSeverityDistribution(hoursBack);
  }

  @Get('actor-risk-distribution')
  @ApiOperation({ summary: 'Get actor risk distribution' })
  @ApiResponse({ status: 200, description: 'Actor risk distribution' })
  async getActorRiskDistribution() {
    return await this.visualizationService.getActorRiskDistribution();
  }

  @Get('time-series')
  @ApiOperation({ summary: 'Get time-series alert data' })
  @ApiResponse({ status: 200, description: 'Time-series data' })
  async getTimeSeries(@Query() query: DTOs.GetTimeSeriesDto) {
    const startTime = new Date(Date.now() - query.hoursBack * 3600000);
    const endTime = new Date();
    return await this.visualizationService.getAlertsOverTime(
      startTime,
      endTime,
      query.interval,
      query.anomalyType as any,
    );
  }

  /**
   * ============ BACKTESTING ============
   */

  @Post('backtest/run')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Run backtest on historical data' })
  @ApiResponse({ status: 201, description: 'Backtest started' })
  async runBacktest(@Body() dto: DTOs.RunBacktestDto) {
    return await this.backtestService.runBacktest(dto);
  }

  @Get('backtest/:testId')
  @ApiOperation({ summary: 'Get backtest results' })
  @ApiParam({ name: 'testId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Backtest results' })
  async getBacktestResult(@Param('testId') testId: string) {
    return this.backtestService.getBacktestResult(testId);
  }

  @Get('backtest')
  @ApiOperation({ summary: 'List recent backtests' })
  @ApiResponse({ status: 200, description: 'List of backtests' })
  async listBacktests(@Query('limit') limit: number = 10) {
    return this.backtestService.recentBacktests(limit);
  }

  @Post('backtest/analyze-patterns')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Analyze pattern effectiveness' })
  @ApiResponse({ status: 200, description: 'Pattern analysis' })
  async analyzePatterns(@Body() dto: DTOs.AnalyzePatternsDto) {
    return await this.backtestService.analyzePatterns(
      dto.startDate,
      dto.endDate,
      dto.patterns,
    );
  }

  @Post('backtest/compare-models')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Compare ML model performance' })
  @ApiResponse({ status: 200, description: 'Model comparison' })
  async compareModels(@Body() dto: DTOs.CompareModelsDto) {
    return await this.backtestService.compareModels(
      dto.startDate,
      dto.endDate,
      dto.modelIds,
    );
  }

  @Post('backtest/simulate-detection')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Simulate pattern detection on historical data' })
  @ApiResponse({ status: 200, description: 'Simulation results' })
  async simulateDetection(@Body() dto: DTOs.SimulateDetectionDto) {
    return await this.backtestService.simulateDetection(
      dto.startDate,
      dto.endDate,
      dto.tradingPairs,
    );
  }

  /**
   * ============ ML MODELS ============
   */

  @Get('models')
  @ApiOperation({ summary: 'Get active ML models' })
  @ApiResponse({ status: 200, description: 'List of ML models' })
  async getModels() {
    return await this.mlInferenceService.getActiveModels();
  }

  @Get('models/:modelId')
  @ApiOperation({ summary: 'Get ML model details' })
  @ApiParam({ name: 'modelId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Model details' })
  async getModel(@Param('modelId') modelId: string) {
    return await this.mlInferenceService.getModel(modelId);
  }

  /**
   * ============ HEALTH & CONFIG ============
   */

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async health() {
    return { status: 'healthy', timestamp: new Date() };
  }

  @Get('config')
  @ApiOperation({ summary: 'Get surveillance system configuration' })
  @ApiResponse({ status: 200, description: 'Configuration' })
  async getConfig() {
    return {
      dedupWindowMs: 60000,
      dedupThreshold: 0.85,
      escalationThreshold: 5,
      autoThrottleViolationLimit: 10,
      autoThrottlePeriodHours: 1,
    };
  }

  /**
   * ============ EXPORTS ============
   */

  @Post('export/report')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate and export report' })
  @ApiResponse({ status: 201, description: 'Report generated' })
  async exportReport(@Body() dto: DTOs.ExportReportDto) {
    // Implementation: Generate report and return download URL
    return {
      reportId: `report_${Date.now()}`,
      format: dto.format,
      period: { startDate: dto.startDate, endDate: dto.endDate },
      generatedAt: new Date(),
      downloadUrl: `/reports/report_${Date.now()}`,
      sizeBytes: 0,
    };
  }

  @Get('export/:reportId')
  @ApiOperation({ summary: 'Download generated report' })
  @ApiParam({ name: 'reportId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Report file' })
  async downloadReport(@Param('reportId') reportId: string) {
    // Implementation: Stream report file
    return { message: 'Report download' };
  }
}

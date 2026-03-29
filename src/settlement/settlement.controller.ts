import { Controller, Post, Get, Put, Delete, Body, Param, Query, UseFilters, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SettlementService } from '../services/settlement.service';
import { SettlementBatchService } from '../services/settlement-batch.service';
import { FXRateService } from '../services/fx-rate.service';
import { CurrencyComplianceService } from '../services/currency-compliance.service';
import { SettlementReconciliationService } from '../services/settlement-reconciliation.service';
import { SettlementMonitoringService } from '../services/settlement-monitoring.service';
import { CreateSettlementDto, SettlementResponseDto, SettlementQueryDto } from '../dto/settlement.dto';
import { CreateSettlementBatchDto, SubmitBatchDto, ApproveBatchDto, RejectBatchDto, SettlementBatchResponseDto } from '../dto/batch.dto';
import { CreateFXRateDto, FXRateDto, ConversionResultDto, FXRateQueryDto, ConvertAmountDto } from '../dto/fx-rate.dto';
import { InitiateReconciliationDto, ResolveDiscrepancyDto, ReconciliationSummaryDto } from '../dto/reconciliation.dto';
import { CreateCurrencyConfigDto, CurrencyConfigResponseDto, CurrencyComplianceCheckDto } from '../dto/currency-config.dto';

@ApiTags('Settlement Engine')
@ApiBearerAuth()
@Controller('settlement')
export class SettlementController {
  private readonly logger = new Logger(SettlementController.name);

  constructor(
    private settlementService: SettlementService,
    private batchService: SettlementBatchService,
    private fxRateService: FXRateService,
    private complianceService: CurrencyComplianceService,
    private reconciliationService: SettlementReconciliationService,
    private monitoringService: SettlementMonitoringService,
  ) {}

  // ========== SETTLEMENT ENDPOINTS ==========

  @Post('settlements')
  @ApiOperation({ summary: 'Create new settlement instruction' })
  @ApiResponse({ status: 201, type: SettlementResponseDto })
  async createSettlement(@Body() dto: CreateSettlementDto): Promise<SettlementResponseDto> {
    return this.settlementService.createSettlement(dto);
  }

  @Get('settlements/:id')
  @ApiOperation({ summary: 'Get settlement by ID' })
  @ApiResponse({ status: 200, type: SettlementResponseDto })
  async getSettlement(@Param('id') id: string): Promise<SettlementResponseDto> {
    return this.settlementService.getSettlement(id);
  }

  @Get('settlements')
  @ApiOperation({ summary: 'List settlements with filters' })
  @ApiResponse({ status: 200, isArray: true })
  async listSettlements(@Query() query: SettlementQueryDto): Promise<any> {
    return this.settlementService.listSettlements({
      status: query.status,
      currency: query.currency,
      batchId: query.batchId,
      skip: query.skip ?? 0,
      take: query.take ?? 50,
    });
  }

  @Post('settlements/:id/initiate')
  @ApiOperation({ summary: 'Initiate settlement execution' })
  @ApiResponse({ status: 200, type: SettlementResponseDto })
  async initiateSettlement(@Param('id') id: string): Promise<SettlementResponseDto> {
    return this.settlementService.initiateSettlement(id);
  }

  @Post('settlements/:id/convert')
  @ApiOperation({ summary: 'Execute FX conversion for settlement' })
  @ApiResponse({ status: 200, type: SettlementResponseDto })
  async convertSettlement(@Param('id') id: string): Promise<SettlementResponseDto> {
    return this.settlementService.executeConversion(id);
  }

  @Post('settlements/:id/route')
  @ApiOperation({ summary: 'Route settlement to execution' })
  @ApiResponse({ status: 200, type: SettlementResponseDto })
  async routeSettlement(@Param('id') id: string): Promise<SettlementResponseDto> {
    return this.settlementService.routeSettlement(id);
  }

  @Post('settlements/:id/complete')
  @ApiOperation({ summary: 'Mark settlement as completed' })
  @ApiResponse({ status: 200, type: SettlementResponseDto })
  async completeSettlement(
    @Param('id') id: string,
    @Body() body: { executedAmount?: number; reference?: string },
  ): Promise<SettlementResponseDto> {
    return this.settlementService.completeSettlement(id, body.executedAmount, body.reference);
  }

  @Post('settlements/:id/fail')
  @ApiOperation({ summary: 'Mark settlement as failed' })
  @ApiResponse({ status: 200, type: SettlementResponseDto })
  async failSettlement(
    @Param('id') id: string,
    @Body() body: { reason: string },
  ): Promise<SettlementResponseDto> {
    return this.settlementService.failSettlement(id, body.reason);
  }

  @Post('settlements/:id/retry')
  @ApiOperation({ summary: 'Retry failed settlement' })
  @ApiResponse({ status: 200, type: SettlementResponseDto })
  async retrySettlement(@Param('id') id: string): Promise<SettlementResponseDto> {
    return this.settlementService.retrySettlement(id);
  }

  @Post('settlements/:id/compliance/approve')
  @ApiOperation({ summary: 'Approve settlement compliance review' })
  @ApiResponse({ status: 200, type: SettlementResponseDto })
  async approveCompliance(@Param('id') id: string): Promise<SettlementResponseDto> {
    return this.settlementService.approveComplianceReview(id);
  }

  @Post('settlements/:id/reconcile')
  @ApiOperation({ summary: 'Mark settlement as reconciled' })
  @ApiResponse({ status: 200, type: SettlementResponseDto })
  async reconcileSettlement(@Param('id') id: string): Promise<SettlementResponseDto> {
    return this.settlementService.markAsReconciled(id);
  }

  // ========== BATCH ENDPOINTS ==========

  @Post('batches')
  @ApiOperation({ summary: 'Create settlement batch' })
  @ApiResponse({ status: 201, type: SettlementBatchResponseDto })
  async createBatch(@Body() dto: CreateSettlementBatchDto): Promise<SettlementBatchResponseDto> {
    return this.batchService.createBatch(dto);
  }

  @Get('batches/:id')
  @ApiOperation({ summary: 'Get batch by ID' })
  @ApiResponse({ status: 200, type: SettlementBatchResponseDto })
  async getBatch(@Param('id') id: string): Promise<SettlementBatchResponseDto> {
    return this.batchService.getBatchWithDetails(id);
  }

  @Get('batches')
  @ApiOperation({ summary: 'List batches' })
  @ApiResponse({ status: 200, isArray: true })
  async listBatches(
    @Query('status') status?: string,
    @Query('currency') currency?: string,
    @Query('skip') skip: number = 0,
    @Query('take') take: number = 50,
  ): Promise<any> {
    return this.batchService.listBatches({ status: status as any, currency, skip, take });
  }

  @Post('batches/:id/submit')
  @ApiOperation({ summary: 'Submit batch for processing' })
  @ApiResponse({ status: 200, type: SettlementBatchResponseDto })
  async submitBatch(
    @Param('id') id: string,
    @Body() dto: SubmitBatchDto,
  ): Promise<SettlementBatchResponseDto> {
    return this.batchService.submitBatch({ ...dto, batchId: id });
  }

  @Post('batches/:id/approve')
  @ApiOperation({ summary: 'Approve batch' })
  @ApiResponse({ status: 200, type: SettlementBatchResponseDto })
  async approveBatch(
    @Param('id') id: string,
    @Body() dto: ApproveBatchDto,
  ): Promise<SettlementBatchResponseDto> {
    return this.batchService.approveBatch({ ...dto, batchId: id }, 'user-id');
  }

  @Post('batches/:id/reject')
  @ApiOperation({ summary: 'Reject batch' })
  @ApiResponse({ status: 200, type: SettlementBatchResponseDto })
  async rejectBatch(
    @Param('id') id: string,
    @Body() dto: RejectBatchDto,
  ): Promise<SettlementBatchResponseDto> {
    return this.batchService.rejectBatch({ ...dto, batchId: id }, 'user-id');
  }

  @Post('batches/:id/process')
  @ApiOperation({ summary: 'Start batch processing' })
  @ApiResponse({ status: 200, type: SettlementBatchResponseDto })
  async processBatch(@Param('id') id: string): Promise<SettlementBatchResponseDto> {
    return this.batchService.processBatch(id);
  }

  @Post('batches/:id/complete')
  @ApiOperation({ summary: 'Mark batch as complete' })
  @ApiResponse({ status: 200, type: SettlementBatchResponseDto })
  async completeBatch(@Param('id') id: string): Promise<SettlementBatchResponseDto> {
    return this.batchService.completeBatch(id);
  }

  @Post('batches/:id/reconcile')
  @ApiOperation({ summary: 'Mark batch as reconciled' })
  @ApiResponse({ status: 200, type: SettlementBatchResponseDto })
  async reconcileBatch(@Param('id') id: string): Promise<SettlementBatchResponseDto> {
    return this.batchService.markAsReconciled(id);
  }

  @Post('batches/:id/retry')
  @ApiOperation({ summary: 'Retry failed batch' })
  @ApiResponse({ status: 200, type: SettlementBatchResponseDto })
  async retryBatch(@Param('id') id: string): Promise<SettlementBatchResponseDto> {
    return this.batchService.retryBatch(id);
  }

  @Get('batches/:id/statistics')
  @ApiOperation({ summary: 'Get batch statistics' })
  @ApiResponse({ status: 200 })
  async getBatchStatistics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<any> {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    return this.batchService.getBatchStatistics(start, end);
  }

  // ========== FX RATE ENDPOINTS ==========

  @Post('fx-rates')
  @ApiOperation({ summary: 'Create or update FX rate' })
  @ApiResponse({ status: 201, type: FXRateDto })
  async upsertFXRate(@Body() dto: CreateFXRateDto): Promise<FXRateDto> {
    return this.fxRateService.upsertFXRate(dto);
  }

  @Get('fx-rates/:fromCurrency/:toCurrency')
  @ApiOperation({ summary: 'Get active FX rate' })
  @ApiResponse({ status: 200, type: FXRateDto })
  async getActiveRate(
    @Param('fromCurrency') fromCurrency: string,
    @Param('toCurrency') toCurrency: string,
  ): Promise<FXRateDto> {
    return this.fxRateService.getActiveRate(fromCurrency, toCurrency);
  }

  @Get('fx-rates/:fromCurrency/:toCurrency/history')
  @ApiOperation({ summary: 'Get FX rate history' })
  @ApiResponse({ status: 200, isArray: true })
  async getFXRateHistory(
    @Param('fromCurrency') fromCurrency: string,
    @Param('toCurrency') toCurrency: string,
    @Query('days') days: number = 30,
  ): Promise<any> {
    return this.fxRateService.getHistory({
      fromCurrency,
      toCurrency,
      days,
      skipRecords: 0,
      takeRecords: 100,
    });
  }

  @Post('fx-rates/convert')
  @ApiOperation({ summary: 'Convert amount between currencies' })
  @ApiResponse({ status: 200, type: ConversionResultDto })
  async convertAmount(@Body() dto: ConvertAmountDto): Promise<ConversionResultDto> {
    return this.fxRateService.convertAmount(dto.amount, dto.fromCurrency, dto.toCurrency, dto.source);
  }

  @Get('fx-rates/:fromCurrency/:toCurrency/volatility')
  @ApiOperation({ summary: 'Check volatility alert' })
  @ApiResponse({ status: 200 })
  async checkVolatility(
    @Param('fromCurrency') fromCurrency: string,
    @Param('toCurrency') toCurrency: string,
    @Query('threshold') threshold: number = 10,
  ): Promise<any> {
    return this.fxRateService.checkVolatilityAlert(fromCurrency, toCurrency, threshold);
  }

  @Get('fx-rates/:fromCurrency/:toCurrency/statistics')
  @ApiOperation({ summary: 'Get FX statistics' })
  @ApiResponse({ status: 200 })
  async getFXStatistics(
    @Param('fromCurrency') fromCurrency: string,
    @Param('toCurrency') toCurrency: string,
    @Query('days') days: number = 30,
  ): Promise<any> {
    return this.fxRateService.getFxStatistics(fromCurrency, toCurrency, days);
  }

  @Post('fx-rates/expire')
  @ApiOperation({ summary: 'Expire old FX rates' })
  @ApiResponse({ status: 200 })
  async expireOldRates(): Promise<any> {
    const expired = await this.fxRateService.expireOldRates();
    return { expired };
  }

  // ========== COMPLIANCE ENDPOINTS ==========

  @Post('compliance/check')
  @ApiOperation({ summary: 'Perform compliance check' })
  @ApiResponse({ status: 200 })
  async performComplianceCheck(@Body() dto: CurrencyComplianceCheckDto): Promise<any> {
    return this.complianceService.performComplianceCheck(dto);
  }

  @Get('compliance/:currency')
  @ApiOperation({ summary: 'Get compliance summary' })
  @ApiResponse({ status: 200 })
  async getComplianceSummary(@Param('currency') currency: string): Promise<any> {
    return this.complianceService.getComplianceSummary(currency);
  }

  @Put('currency-config/:currency')
  @ApiOperation({ summary: 'Update currency configuration' })
  @ApiResponse({ status: 200, type: CurrencyConfigResponseDto })
  async updateCurrencyConfig(
    @Param('currency') currency: string,
    @Body() dto: CreateCurrencyConfigDto,
  ): Promise<any> {
    // Implementation would update in database
    return { message: 'Updated' };
  }

  @Get('currency-config')
  @ApiOperation({ summary: 'List all currency configurations' })
  @ApiResponse({ status: 200, isArray: true })
  async listCurrencyConfigs(): Promise<any> {
    // Implementation would list all configs
    return [];
  }

  // ========== RECONCILIATION ENDPOINTS ==========

  @Post('reconciliation/initiate')
  @ApiOperation({ summary: 'Initiate batch reconciliation' })
  @ApiResponse({ status: 200, type: ReconciliationSummaryDto })
  async initiateReconciliation(@Body() dto: InitiateReconciliationDto): Promise<ReconciliationSummaryDto> {
    return this.reconciliationService.initiateReconciliation(dto);
  }

  @Post('reconciliation/discrepancies')
  @ApiOperation({ summary: 'Record discrepancy' })
  @ApiResponse({ status: 201 })
  async recordDiscrepancy(
    @Query('batchId') batchId: string,
    @Body() dto: any,
  ): Promise<any> {
    return this.reconciliationService.recordDiscrepancy(batchId, dto);
  }

  @Post('reconciliation/discrepancies/:id/resolve')
  @ApiOperation({ summary: 'Resolve discrepancy' })
  @ApiResponse({ status: 200 })
  async resolveDiscrepancy(
    @Param('id') id: string,
    @Body() dto: ResolveDiscrepancyDto,
  ): Promise<any> {
    return this.reconciliationService.resolveDiscrepancy({ ...dto, discrepancyId: id });
  }

  @Get('reconciliation/open-discrepancies')
  @ApiOperation({ summary: 'Get open discrepancies' })
  @ApiResponse({ status: 200, isArray: true })
  async getOpenDiscrepancies(
    @Query('batchId') batchId?: string,
  ): Promise<any> {
    return this.reconciliationService.getOpenDiscrepancies(batchId);
  }

  @Get('reconciliation/:batchId/report')
  @ApiOperation({ summary: 'Generate reconciliation report' })
  @ApiResponse({ status: 200 })
  async generateReconciliationReport(
    @Param('batchId') batchId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<any> {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    return this.reconciliationService.generateReconciliationReport(start, end);
  }

  @Post('reconciliation/bulk-resolve')
  @ApiOperation({ summary: 'Bulk resolve discrepancies' })
  @ApiResponse({ status: 200 })
  async bulkResolveDiscrepancies(
    @Query('batchId') batchId: string,
    @Body() body: { status: string },
  ): Promise<any> {
    const resolved = await this.reconciliationService.bulkResolveDiscrepancies(batchId, body.status as any);
    return { resolved };
  }

  // ========== MONITORING & REPORTING ENDPOINTS ==========

  @Get('monitoring/health')
  @ApiOperation({ summary: 'Get system health status' })
  @ApiResponse({ status: 200 })
  async getHealthStatus(): Promise<any> {
    return this.monitoringService.getHealthStatus();
  }

  @Get('monitoring/metrics')
  @ApiOperation({ summary: 'Get settlement metrics' })
  @ApiResponse({ status: 200 })
  async getMetrics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<any> {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    return this.monitoringService.getSettlementMetrics(start, end);
  }

  @Get('monitoring/batch-metrics')
  @ApiOperation({ summary: 'Get batch processing metrics' })
  @ApiResponse({ status: 200 })
  async getBatchMetrics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<any> {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    return this.monitoringService.getBatchMetrics(start, end);
  }

  @Get('monitoring/circuit-breaker/:currency')
  @ApiOperation({ summary: 'Get circuit breaker status for currency' })
  @ApiResponse({ status: 200 })
  async getCircuitBreakerStatus(@Param('currency') currency: string): Promise<any> {
    return this.monitoringService.getCircuitBreakerStatus(currency);
  }

  @Get('monitoring/report/daily')
  @ApiOperation({ summary: 'Generate daily report' })
  @ApiResponse({ status: 200 })
  async getDailyReport(@Query('date') date?: string): Promise<any> {
    return this.monitoringService.generateDailyReport(date ? new Date(date) : new Date());
  }

  @Get('monitoring/currency-pair/:fromCurrency/:toCurrency')
  @ApiOperation({ summary: 'Get currency pair performance' })
  @ApiResponse({ status: 200 })
  async getCurrencyPairPerformance(
    @Param('fromCurrency') fromCurrency: string,
    @Param('toCurrency') toCurrency: string,
    @Query('days') days: number = 30,
  ): Promise<any> {
    return this.monitoringService.getCurrencyPairPerformance(fromCurrency, toCurrency, days);
  }

  @Get('monitoring/alerts/thresholds')
  @ApiOperation({ summary: 'Get alert thresholds' })
  @ApiResponse({ status: 200 })
  async getAlertThresholds(): Promise<any> {
    return this.monitoringService.getAlertThresholds();
  }

  @Get('monitoring/export')
  @ApiOperation({ summary: 'Export metrics' })
  @ApiResponse({ status: 200 })
  async exportMetrics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<any> {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    return this.monitoringService.exportMetrics(start, end);
  }

  // ========== UTILITY ENDPOINTS ==========

  @Get('health')
  @ApiOperation({ summary: 'Settlement service health check' })
  @ApiResponse({ status: 200 })
  async serviceHealth(): Promise<any> {
    return { status: 'UP', timestamp: new Date() };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get system-wide statistics' })
  @ApiResponse({ status: 200 })
  async getSystemStats(): Promise<any> {
    const metrics = await this.monitoringService.getSettlementMetrics(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      new Date(),
    );
    const health = await this.monitoringService.getHealthStatus();
    return { metrics, health };
  }
}

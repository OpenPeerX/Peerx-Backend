import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
  Sse,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Observable, map } from 'rxjs';
import { AdvancedAnalyticsService } from '../advanced-analytics.service';
import {
  CreateDashboardDto,
  CreateReportScheduleDto,
  ExportAnalyticsQueryDto,
  PredictiveAnalyticsQueryDto,
  UpdateDashboardDto,
  UpsertBiConnectorDto,
} from '../dto/advanced-analytics.dto';

@ApiTags('advanced-analytics')
@Controller('advanced-analytics')
export class AdvancedAnalyticsController {
  constructor(private readonly analyticsService: AdvancedAnalyticsService) {}

  @Get('realtime/snapshot')
  @ApiOperation({ summary: 'Get comprehensive real-time analytics snapshot' })
  @ApiResponse({ status: 200, description: 'Snapshot generated' })
  getRealtimeSnapshot(@Query('userId') userId = 'global') {
    return this.analyticsService.getComprehensiveSnapshot(userId);
  }

  @Sse('realtime/stream')
  @ApiOperation({ summary: 'SSE stream for real-time analytics updates' })
  getRealtimeStream(@Query('userId') userId = 'global'): Observable<MessageEvent> {
    return this.analyticsService.getRealtimeStream(userId).pipe(
      map((data) => ({ data }) as MessageEvent),
    );
  }

  @Post('dashboards')
  @ApiOperation({ summary: 'Create customizable dashboard' })
  createDashboard(@Body() dto: CreateDashboardDto) {
    return this.analyticsService.createDashboard(dto);
  }

  @Patch('dashboards/:dashboardId')
  @ApiOperation({ summary: 'Update dashboard widgets and filters' })
  updateDashboard(
    @Param('dashboardId') dashboardId: string,
    @Body() dto: UpdateDashboardDto,
  ) {
    return this.analyticsService.updateDashboard(dashboardId, dto);
  }

  @Get('dashboards/:dashboardId')
  @ApiOperation({ summary: 'Get dashboard by ID' })
  getDashboard(@Param('dashboardId') dashboardId: string) {
    return this.analyticsService.getDashboard(dashboardId);
  }

  @Get('dashboards')
  @ApiOperation({ summary: 'List dashboards by user' })
  listDashboards(@Query('userId') userId?: string) {
    return this.analyticsService.listDashboards(userId);
  }

  @Get('charting/series')
  @ApiOperation({ summary: 'Generate advanced charting data series' })
  @ApiQuery({
    name: 'kind',
    enum: ['line', 'bar', 'area', 'candlestick', 'heatmap', 'scatter'],
    required: false,
  })
  getChartSeries(
    @Query('kind') kind: 'line' | 'bar' | 'area' | 'candlestick' | 'heatmap' | 'scatter' = 'line',
  ) {
    return this.analyticsService.generateChartSeries(kind);
  }

  @Get('predictive')
  @ApiOperation({ summary: 'Get predictive analytics forecast' })
  getPredictiveAnalytics(@Query() query: PredictiveAnalyticsQueryDto) {
    return this.analyticsService.getPredictiveAnalytics(query.horizon ?? '24h');
  }

  @Get('behavior/:userId')
  @ApiOperation({ summary: 'Get user behavior analytics' })
  getUserBehavior(@Param('userId') userId: string) {
    return this.analyticsService.getUserBehaviorAnalytics(userId);
  }

  @Get('market-trends')
  @ApiOperation({ summary: 'Get market trend analysis' })
  @ApiQuery({ name: 'interval', enum: ['1m', '5m', '1h', '1d'], required: false })
  getMarketTrends(
    @Query('interval') interval: '1m' | '5m' | '1h' | '1d' = '5m',
  ) {
    return this.analyticsService.getMarketTrendAnalysis(interval);
  }

  @Get('system-metrics')
  @ApiOperation({ summary: 'Get system performance metrics and health indicators' })
  getSystemMetrics() {
    return this.analyticsService.getSystemPerformanceMetrics();
  }

  @Post('reports/generate')
  @ApiOperation({ summary: 'Generate analytics report on demand' })
  generateReport(
    @Query('userId') userId = 'global',
    @Query('format') format: 'json' | 'csv' | 'xlsx' = 'json',
  ) {
    return this.analyticsService.generateReportNow(userId, format);
  }

  @Post('reports/schedules')
  @ApiOperation({ summary: 'Create automated report schedule' })
  createReportSchedule(@Body() dto: CreateReportScheduleDto) {
    return this.analyticsService.createReportSchedule(dto);
  }

  @Get('reports/schedules')
  @ApiOperation({ summary: 'List automated report schedules' })
  listReportSchedules(@Query('userId') userId?: string) {
    return this.analyticsService.listReportSchedules(userId);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export analytics data to JSON/CSV' })
  @Header('Cache-Control', 'no-store')
  async exportAnalytics(
    @Query() query: ExportAnalyticsQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const format = query.format ?? 'json';
    const scope = query.scope ?? 'snapshot';
    const userId = query.userId ?? 'global';

    const exported = this.analyticsService.exportAnalyticsData(scope, format, userId);

    res.setHeader('Content-Type', exported.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
    res.status(200).send(exported.body);
  }

  @Get('bi/connectors')
  @ApiOperation({ summary: 'List external BI connectors' })
  listConnectors() {
    return this.analyticsService.listConnectors();
  }

  @Post('bi/connectors')
  @ApiOperation({ summary: 'Create or update external BI connector configuration' })
  upsertConnector(@Body() dto: UpsertBiConnectorDto) {
    return this.analyticsService.upsertConnector(dto);
  }

  @Post('bi/connectors/:connectorId/push')
  @ApiOperation({ summary: 'Push analytics snapshot to external BI tool' })
  pushToBi(@Param('connectorId') connectorId: string, @Query('userId') userId = 'global') {
    return this.analyticsService.pushToBiTool(connectorId, userId);
  }
}

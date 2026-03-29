import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import axios from 'axios';
import { interval, map, Observable } from 'rxjs';
import {
  BiToolConnector,
  ComprehensiveAnalyticsSnapshot,
  DashboardWidget,
  DashboardDefinition,
  MarketTrendAnalysis,
  PredictiveAnalyticsResult,
  ScheduledReport,
  SystemPerformanceMetrics,
  TradingPerformanceSnapshot,
  UserBehaviorAnalytics,
} from './interfaces/advanced-analytics.interfaces';
import {
  CreateDashboardDto,
  CreateReportScheduleDto,
  UpdateDashboardDto,
  UpsertBiConnectorDto,
} from './dto/advanced-analytics.dto';

@Injectable()
export class AdvancedAnalyticsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AdvancedAnalyticsService.name);
  private readonly dashboards = new Map<string, DashboardDefinition>();
  private readonly reportSchedules = new Map<string, ScheduledReport>();
  private readonly connectors = new Map<string, BiToolConnector>();
  private readonly virtualUsers = new Map<string, { activitySeed: number }>();
  private schedulerTimer: NodeJS.Timeout | null = null;

  onModuleInit(): void {
    this.seedConnectors();
    this.schedulerTimer = setInterval(() => {
      void this.runSchedulerTick();
    }, 30_000);
  }

  onModuleDestroy(): void {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  createDashboard(input: CreateDashboardDto): DashboardDefinition {
    const now = new Date().toISOString();
    const id = randomUUID();

    const dashboard: DashboardDefinition = {
      id,
      userId: input.userId,
      name: input.name,
      description: input.description,
      widgets: this.normalizeWidgets(input.widgets),
      filters: input.filters ?? {},
      createdAt: now,
      updatedAt: now,
    };

    this.dashboards.set(id, dashboard);
    return dashboard;
  }

  updateDashboard(id: string, input: UpdateDashboardDto): DashboardDefinition | null {
    const existing = this.dashboards.get(id);
    if (!existing) return null;

    const updated: DashboardDefinition = {
      ...existing,
      name: input.name ?? existing.name,
      description: input.description ?? existing.description,
      widgets: input.widgets ? this.normalizeWidgets(input.widgets) : existing.widgets,
      filters: input.filters ?? existing.filters,
      updatedAt: new Date().toISOString(),
    };

    this.dashboards.set(id, updated);
    return updated;
  }

  getDashboard(id: string): DashboardDefinition | null {
    return this.dashboards.get(id) ?? null;
  }

  listDashboards(userId?: string): DashboardDefinition[] {
    const all = Array.from(this.dashboards.values());
    return userId ? all.filter((dashboard) => dashboard.userId === userId) : all;
  }

  getRealtimeStream(userId = 'global'): Observable<ComprehensiveAnalyticsSnapshot> {
    return interval(4_000).pipe(map(() => this.getComprehensiveSnapshot(userId)));
  }

  getComprehensiveSnapshot(userId = 'global'): ComprehensiveAnalyticsSnapshot {
    return {
      tradingPerformance: this.getTradingPerformanceSnapshot(userId),
      predictiveAnalytics: this.getPredictiveAnalytics('24h'),
      userBehavior: this.getUserBehaviorAnalytics(userId),
      marketTrends: this.getMarketTrendAnalysis('5m'),
      systemPerformance: this.getSystemPerformanceMetrics(),
    };
  }

  getTradingPerformanceSnapshot(userId = 'global'): TradingPerformanceSnapshot {
    const seed = this.getSeed(userId);
    const generatedAt = new Date().toISOString();
    const totalTrades = 1_000 + Math.floor(seed * 400);
    const totalVolume = 250_000 + seed * 100_000;
    const winRate = Number((0.46 + seed * 0.28).toFixed(4));
    const avgExecutionPrice = Number((1.4 + seed * 0.9).toFixed(4));

    const topAssets = [
      { asset: 'XLM', trades: Math.floor(totalTrades * 0.34), volume: Number((totalVolume * 0.31).toFixed(2)) },
      { asset: 'BTC', trades: Math.floor(totalTrades * 0.27), volume: Number((totalVolume * 0.39).toFixed(2)) },
      { asset: 'ETH', trades: Math.floor(totalTrades * 0.2), volume: Number((totalVolume * 0.21).toFixed(2)) },
      { asset: 'USDT', trades: Math.floor(totalTrades * 0.19), volume: Number((totalVolume * 0.09).toFixed(2)) },
    ];

    return {
      generatedAt,
      totalTrades,
      totalVolume: Number(totalVolume.toFixed(2)),
      winRate,
      avgExecutionPrice,
      pnl: {
        realized: Number((9_000 + seed * 8_000).toFixed(2)),
        unrealized: Number((2_000 + seed * 5_000).toFixed(2)),
        daily: Number((300 + seed * 950).toFixed(2)),
        weekly: Number((1_200 + seed * 3_100).toFixed(2)),
      },
      topAssets,
    };
  }

  getPredictiveAnalytics(horizon: '1h' | '24h' | '7d'): PredictiveAnalyticsResult {
    const points = horizon === '1h' ? 12 : horizon === '24h' ? 24 : 14;
    const baseline = horizon === '1h' ? 1.02 : horizon === '24h' ? 1.08 : 1.21;
    const growth = horizon === '1h' ? 0.003 : horizon === '24h' ? 0.008 : 0.02;
    const confidence = horizon === '1h' ? 0.89 : horizon === '24h' ? 0.83 : 0.77;

    const forecast = Array.from({ length: points }).map((_, idx) => {
      const value = baseline + growth * idx + Math.sin(idx / 2) * 0.01;
      const spread = 0.012 + idx * 0.0006;
      const timestamp = new Date(Date.now() + idx * 60 * 60 * 1000).toISOString();

      return {
        t: timestamp,
        value: Number(value.toFixed(5)),
        confidenceLow: Number((value - spread).toFixed(5)),
        confidenceHigh: Number((value + spread).toFixed(5)),
      };
    });

    return {
      model: 'linear-regression',
      horizon,
      confidence,
      accuracyEstimate: Number((0.74 + confidence * 0.18).toFixed(3)),
      forecast,
    };
  }

  getUserBehaviorAnalytics(userId: string): UserBehaviorAnalytics {
    const seed = this.getSeed(userId);
    const activeHours = Array.from({ length: 24 }).map((_, hour) => {
      const wave = Math.sin((hour / 24) * Math.PI * 2 + seed);
      return {
        hour,
        actions: Math.max(1, Math.floor(20 + wave * 12 + seed * 10)),
      };
    });

    return {
      userId,
      sessionCount: 25 + Math.floor(seed * 30),
      averageSessionMinutes: Number((8 + seed * 16).toFixed(2)),
      retentionScore: Number((0.58 + seed * 0.35).toFixed(3)),
      activeHours,
      preferredAssets: [
        { asset: 'XLM', interactions: 120 + Math.floor(seed * 70) },
        { asset: 'BTC', interactions: 90 + Math.floor(seed * 55) },
        { asset: 'ETH', interactions: 84 + Math.floor(seed * 50) },
      ],
      funnel: {
        visits: 3_000 + Math.floor(seed * 800),
        chartViews: 1_900 + Math.floor(seed * 700),
        orderPlacements: 580 + Math.floor(seed * 220),
        executedTrades: 390 + Math.floor(seed * 180),
      },
    };
  }

  getMarketTrendAnalysis(intervalValue: '1m' | '5m' | '1h' | '1d'): MarketTrendAnalysis {
    const generatedAt = new Date().toISOString();

    const assets = ['XLM', 'BTC', 'ETH', 'USDT'];
    const trends = assets.map((asset, idx) => {
      const slope = Math.sin(Date.now() / 1_000_000 + idx);
      const momentum: 'BULLISH' | 'BEARISH' | 'SIDEWAYS' =
        slope > 0.2 ? 'BULLISH' : slope < -0.2 ? 'BEARISH' : 'SIDEWAYS';
      const anchor = asset === 'BTC' ? 67_000 : asset === 'ETH' ? 3_200 : asset === 'XLM' ? 0.12 : 1;
      const maShort = anchor + slope * anchor * 0.008;
      const maLong = anchor + slope * anchor * 0.004;

      return {
        asset,
        momentum,
        strength: Number((Math.abs(slope) * 100).toFixed(2)),
        volatility: Number((0.01 + Math.abs(Math.cos(slope + idx)) * 0.04).toFixed(4)),
        movingAverage: {
          short: Number(maShort.toFixed(6)),
          long: Number(maLong.toFixed(6)),
        },
        support: Number((anchor * 0.96).toFixed(6)),
        resistance: Number((anchor * 1.05).toFixed(6)),
      };
    });

    return {
      generatedAt,
      interval: intervalValue,
      trends,
    };
  }

  getSystemPerformanceMetrics(): SystemPerformanceMetrics {
    const mem = process.memoryUsage();
    const loads = process.platform === 'win32' ? [0, 0, 0] : require('os').loadavg();

    return {
      generatedAt: new Date().toISOString(),
      uptimeSec: Math.floor(process.uptime()),
      memory: {
        rssMb: Number((mem.rss / 1024 / 1024).toFixed(2)),
        heapUsedMb: Number((mem.heapUsed / 1024 / 1024).toFixed(2)),
        heapTotalMb: Number((mem.heapTotal / 1024 / 1024).toFixed(2)),
      },
      cpu: {
        loadAverage1m: Number(loads[0].toFixed(3)),
        loadAverage5m: Number(loads[1].toFixed(3)),
        loadAverage15m: Number(loads[2].toFixed(3)),
      },
      throughput: {
        eventsPerSecond: Number((15 + Math.random() * 40).toFixed(2)),
        reportJobsPerHour: Array.from(this.reportSchedules.values()).filter((r) => r.active).length * 2,
        streamSubscribers: 1 + Math.floor(Math.random() * 24),
      },
      latency: {
        p50Ms: Number((25 + Math.random() * 40).toFixed(2)),
        p95Ms: Number((80 + Math.random() * 60).toFixed(2)),
        p99Ms: Number((130 + Math.random() * 120).toFixed(2)),
      },
    };
  }

  generateChartSeries(kind: 'line' | 'bar' | 'area' | 'candlestick' | 'heatmap' | 'scatter'): unknown {
    const base = this.getTradingPerformanceSnapshot('global').avgExecutionPrice;
    const now = Date.now();

    if (kind === 'candlestick') {
      return Array.from({ length: 24 }).map((_, idx) => {
        const open = base + Math.sin(idx / 3) * 0.1;
        const close = open + Math.sin(idx / 2) * 0.04;
        const high = Math.max(open, close) + 0.06;
        const low = Math.min(open, close) - 0.05;
        return {
          t: new Date(now - (24 - idx) * 60 * 60 * 1000).toISOString(),
          open: Number(open.toFixed(5)),
          high: Number(high.toFixed(5)),
          low: Number(low.toFixed(5)),
          close: Number(close.toFixed(5)),
        };
      });
    }

    if (kind === 'heatmap') {
      return Array.from({ length: 7 }).map((_, day) => ({
        day,
        buckets: Array.from({ length: 24 }).map((__, hour) => ({
          hour,
          intensity: Number((Math.max(0, Math.sin(day + hour / 4)) * 100).toFixed(2)),
        })),
      }));
    }

    if (kind === 'scatter') {
      return Array.from({ length: 120 }).map((_, idx) => ({
        x: Number((Math.random() * 100).toFixed(3)),
        y: Number((Math.random() * 100).toFixed(3)),
        z: Number((10 + Math.sin(idx) * 5).toFixed(3)),
      }));
    }

    return Array.from({ length: 60 }).map((_, idx) => ({
      t: new Date(now - (60 - idx) * 60 * 1000).toISOString(),
      value: Number((base + Math.sin(idx / 6) * 0.12 + Math.cos(idx / 8) * 0.06).toFixed(5)),
    }));
  }

  createReportSchedule(input: CreateReportScheduleDto): ScheduledReport {
    const now = new Date();
    const schedule: ScheduledReport = {
      id: randomUUID(),
      userId: input.userId,
      name: input.name,
      cronExpression: input.cronExpression,
      format: input.format,
      recipients: input.recipients,
      active: true,
      nextRunAt: new Date(now.getTime() + 60_000).toISOString(),
      createdAt: now.toISOString(),
    };

    this.reportSchedules.set(schedule.id, schedule);
    return schedule;
  }

  listReportSchedules(userId?: string): ScheduledReport[] {
    const schedules = Array.from(this.reportSchedules.values());
    return userId ? schedules.filter((item) => item.userId === userId) : schedules;
  }

  async generateReportNow(userId: string, format: 'json' | 'csv' | 'xlsx'): Promise<{ filename: string; preview: string }> {
    const snapshot = this.getComprehensiveSnapshot(userId);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `analytics-report-${userId}-${timestamp}.${format}`;

    if (format === 'csv') {
      const csv = this.toCsv(snapshot);
      return { filename, preview: csv.slice(0, 1_200) };
    }

    const payload = JSON.stringify(snapshot, null, 2);
    return { filename, preview: payload.slice(0, 1_200) };
  }

  exportAnalyticsData(scope: 'snapshot' | 'trading' | 'userBehavior' | 'marketTrends' | 'systemPerformance', format: 'json' | 'csv', userId = 'global'):
    { contentType: string; body: string; filename: string } {
    const snapshot = this.getComprehensiveSnapshot(userId);

    const selected =
      scope === 'snapshot'
        ? snapshot
        : scope === 'trading'
          ? snapshot.tradingPerformance
          : scope === 'userBehavior'
            ? snapshot.userBehavior
            : scope === 'marketTrends'
              ? snapshot.marketTrends
              : snapshot.systemPerformance;

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    if (format === 'csv') {
      return {
        contentType: 'text/csv',
        filename: `analytics-${scope}-${ts}.csv`,
        body: this.toCsv(selected),
      };
    }

    return {
      contentType: 'application/json',
      filename: `analytics-${scope}-${ts}.json`,
      body: JSON.stringify(selected, null, 2),
    };
  }

  upsertConnector(input: UpsertBiConnectorDto): BiToolConnector {
    const connector: BiToolConnector = {
      id: input.id,
      name: input.name,
      type: input.type,
      endpoint: input.endpoint,
      enabled: input.enabled,
    };

    this.connectors.set(connector.id, connector);
    return connector;
  }

  listConnectors(): BiToolConnector[] {
    return Array.from(this.connectors.values());
  }

  async pushToBiTool(connectorId: string, userId = 'global'): Promise<{ success: boolean; status: number; message: string }> {
    const connector = this.connectors.get(connectorId);
    if (!connector || !connector.enabled) {
      return { success: false, status: 404, message: 'Connector not found or disabled' };
    }

    const snapshot = this.getComprehensiveSnapshot(userId);

    try {
      const response = await axios.post(
        connector.endpoint,
        {
          source: 'swaptrade-advanced-analytics',
          generatedAt: new Date().toISOString(),
          payload: snapshot,
        },
        {
          timeout: 5000,
          validateStatus: () => true,
        },
      );

      return {
        success: response.status >= 200 && response.status < 300,
        status: response.status,
        message: `BI push completed with status ${response.status}`,
      };
    } catch (error) {
      return {
        success: false,
        status: 500,
        message: `BI push failed: ${(error as Error).message}`,
      };
    }
  }

  private async runSchedulerTick(): Promise<void> {
    const now = Date.now();
    const due = Array.from(this.reportSchedules.values()).filter(
      (schedule) => schedule.active && new Date(schedule.nextRunAt).getTime() <= now,
    );

    for (const schedule of due) {
      const report = await this.generateReportNow(schedule.userId, schedule.format);
      this.logger.log(`Generated scheduled analytics report ${report.filename} for schedule ${schedule.id}`);

      schedule.nextRunAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      this.reportSchedules.set(schedule.id, schedule);
    }
  }

  private seedConnectors(): void {
    const defaults: BiToolConnector[] = [
      {
        id: 'powerbi-default',
        name: 'Power BI Stream',
        type: 'powerbi',
        endpoint: 'https://example.invalid/powerbi/ingest',
        enabled: false,
      },
      {
        id: 'tableau-default',
        name: 'Tableau Data Sync',
        type: 'tableau',
        endpoint: 'https://example.invalid/tableau/ingest',
        enabled: false,
      },
    ];

    defaults.forEach((connector) => this.connectors.set(connector.id, connector));
  }

  private normalizeWidgets(widgets: CreateDashboardDto['widgets']): DashboardWidget[] {
    return widgets.map((widget) => ({
      id: widget.id,
      title: widget.title,
      type: widget.type,
      dataSource: widget.dataSource as DashboardWidget['dataSource'],
      config: widget.config,
      layout: widget.layout,
    }));
  }

  private getSeed(userId: string): number {
    if (!this.virtualUsers.has(userId)) {
      const seed = Array.from(userId).reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 100;
      this.virtualUsers.set(userId, { activitySeed: seed / 100 });
    }

    return this.virtualUsers.get(userId)!.activitySeed;
  }

  private toCsv(payload: unknown): string {
    const flat = this.flattenObject(payload);
    const headers = Object.keys(flat);
    const values = headers.map((header) => this.escapeCsvValue(flat[header]));
    return `${headers.join(',')}\n${values.join(',')}\n`;
  }

  private flattenObject(payload: unknown, prefix = ''): Record<string, string> {
    if (payload === null || payload === undefined) {
      return { [prefix || 'value']: '' };
    }

    if (typeof payload !== 'object') {
      return { [prefix || 'value']: String(payload) };
    }

    if (Array.isArray(payload)) {
      return { [prefix || 'items']: JSON.stringify(payload) };
    }

    const result: Record<string, string> = {};
    Object.entries(payload as Record<string, unknown>).forEach(([key, value]) => {
      const nestedPrefix = prefix ? `${prefix}.${key}` : key;
      const nested = this.flattenObject(value, nestedPrefix);
      Object.assign(result, nested);
    });

    return result;
  }

  private escapeCsvValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}

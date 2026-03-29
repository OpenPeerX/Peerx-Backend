export type DashboardWidgetType =
  | 'line'
  | 'bar'
  | 'area'
  | 'candlestick'
  | 'heatmap'
  | 'scatter'
  | 'kpi';

export interface DashboardWidget {
  id: string;
  title: string;
  type: DashboardWidgetType;
  dataSource:
    | 'tradingPerformance'
    | 'marketTrends'
    | 'userBehavior'
    | 'systemMetrics'
    | 'predictiveAnalytics';
  config: Record<string, unknown>;
  layout: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

export interface DashboardDefinition {
  id: string;
  userId: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  filters: {
    from?: string;
    to?: string;
    assets?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface TradingPerformanceSnapshot {
  generatedAt: string;
  totalTrades: number;
  totalVolume: number;
  winRate: number;
  avgExecutionPrice: number;
  pnl: {
    realized: number;
    unrealized: number;
    daily: number;
    weekly: number;
  };
  topAssets: Array<{
    asset: string;
    trades: number;
    volume: number;
  }>;
}

export interface PredictionPoint {
  t: string;
  value: number;
  confidenceLow: number;
  confidenceHigh: number;
}

export interface PredictiveAnalyticsResult {
  model: 'linear-regression';
  horizon: '1h' | '24h' | '7d';
  confidence: number;
  accuracyEstimate: number;
  forecast: PredictionPoint[];
}

export interface UserBehaviorAnalytics {
  userId: string;
  sessionCount: number;
  averageSessionMinutes: number;
  retentionScore: number;
  activeHours: Array<{ hour: number; actions: number }>;
  preferredAssets: Array<{ asset: string; interactions: number }>;
  funnel: {
    visits: number;
    chartViews: number;
    orderPlacements: number;
    executedTrades: number;
  };
}

export interface MarketTrendAnalysis {
  generatedAt: string;
  interval: '1m' | '5m' | '1h' | '1d';
  trends: Array<{
    asset: string;
    momentum: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
    strength: number;
    volatility: number;
    movingAverage: {
      short: number;
      long: number;
    };
    support: number;
    resistance: number;
  }>;
}

export interface SystemPerformanceMetrics {
  generatedAt: string;
  uptimeSec: number;
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
  };
  cpu: {
    loadAverage1m: number;
    loadAverage5m: number;
    loadAverage15m: number;
  };
  throughput: {
    eventsPerSecond: number;
    reportJobsPerHour: number;
    streamSubscribers: number;
  };
  latency: {
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
  };
}

export interface ComprehensiveAnalyticsSnapshot {
  tradingPerformance: TradingPerformanceSnapshot;
  predictiveAnalytics: PredictiveAnalyticsResult;
  userBehavior: UserBehaviorAnalytics;
  marketTrends: MarketTrendAnalysis;
  systemPerformance: SystemPerformanceMetrics;
}

export interface ScheduledReport {
  id: string;
  userId: string;
  name: string;
  cronExpression: string;
  format: 'json' | 'csv' | 'xlsx';
  recipients: string[];
  active: boolean;
  nextRunAt: string;
  createdAt: string;
}

export interface BiToolConnector {
  id: string;
  name: string;
  type: 'powerbi' | 'tableau' | 'looker' | 'custom-webhook';
  endpoint: string;
  enabled: boolean;
}

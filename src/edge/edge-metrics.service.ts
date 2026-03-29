import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EdgeMetrics {
  timestamp: Date;
  responseTime: {
    p50: number;
    p95: number;
    p99: number;
    average: number;
    max: number;
  };
  throughput: {
    requestsPerSecond: number;
    bytesPerSecond: number;
    totalRequests: number;
  };
  cache: {
    hitRate: number;
    missRate: number;
    totalHits: number;
    totalMisses: number;
  };
  edge: {
    totalNodes: number;
    healthyNodes: number;
    averageLatency: number;
    totalComputeUnits: number;
  };
  cdn: {
    hitRate: number;
    bandwidth: number;
    requests: number;
  };
  geographic: {
    totalRegions: number;
    healthyRegions: number;
    averageLatency: number;
  };
  errors: {
    total: number;
    rate: number;
    byType: Record<string, number>;
  };
}

export interface PerformanceAlert {
  id: string;
  type: 'slow_response' | 'high_error_rate' | 'low_cache_hit' | 'edge_failure' | 'region_failure';
  severity: 'warning' | 'critical';
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: Date;
  region?: string;
  edgeNode?: string;
}

@Injectable()
export class EdgeMetricsService {
  private readonly logger = new Logger(EdgeMetricsService.name);
  private metrics: EdgeMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private responseTimes: number[] = [];
  private requestCount = 0;
  private errorCount = 0;
  private errorsByType: Record<string, number> = {};
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor(private readonly configService: ConfigService) {
    this.startMetricsCollection();
  }

  private startMetricsCollection(): void {
    const config = this.configService.get('edge');
    if (!config?.monitoring?.enabled) {
      this.logger.warn('Edge monitoring is disabled');
      return;
    }

    const interval = config.monitoring.metricsInterval || 60000;
    
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, interval);

    this.logger.log(`Started metrics collection with ${interval}ms interval`);
  }

  private async collectMetrics(): Promise<void> {
    try {
      const metrics = await this.calculateMetrics();
      this.metrics.push(metrics);
      
      // Keep only last 1000 metrics
      if (this.metrics.length > 1000) {
        this.metrics = this.metrics.slice(-1000);
      }

      // Check for alerts
      this.checkAlerts(metrics);

      this.logger.debug('Collected edge metrics');
    } catch (error) {
      this.logger.error(`Failed to collect metrics: ${error.message}`);
    }
  }

  private async calculateMetrics(): Promise<EdgeMetrics> {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    
    // Filter recent response times
    const recentResponseTimes = this.responseTimes.slice(-1000);
    
    // Calculate response time percentiles
    const sortedTimes = [...recentResponseTimes].sort((a, b) => a - b);
    const p50 = this.calculatePercentile(sortedTimes, 50);
    const p95 = this.calculatePercentile(sortedTimes, 95);
    const p99 = this.calculatePercentile(sortedTimes, 99);
    const average = sortedTimes.length > 0
      ? sortedTimes.reduce((sum, time) => sum + time, 0) / sortedTimes.length
      : 0;
    const max = sortedTimes.length > 0 ? Math.max(...sortedTimes) : 0;

    // Calculate throughput
    const requestsPerSecond = this.requestCount / 60; // Last minute
    const bytesPerSecond = 0; // Would track actual bytes in production

    // Get cache stats (would integrate with actual cache service)
    const cacheHitRate = 0.75; // 75% hit rate
    const cacheMissRate = 1 - cacheHitRate;

    // Get edge stats (would integrate with edge computing service)
    const edgeStats = {
      totalNodes: 6,
      healthyNodes: 6,
      averageLatency: 50,
      totalComputeUnits: 60,
    };

    // Get CDN stats (would integrate with CDN service)
    const cdnStats = {
      hitRate: 0.85,
      bandwidth: 1000000,
      requests: this.requestCount,
    };

    // Get geographic stats (would integrate with geographic service)
    const geoStats = {
      totalRegions: 8,
      healthyRegions: 8,
      averageLatency: 45,
    };

    // Calculate error rate
    const errorRate = this.requestCount > 0
      ? (this.errorCount / this.requestCount) * 100
      : 0;

    return {
      timestamp: now,
      responseTime: {
        p50,
        p95,
        p99,
        average,
        max,
      },
      throughput: {
        requestsPerSecond,
        bytesPerSecond,
        totalRequests: this.requestCount,
      },
      cache: {
        hitRate: cacheHitRate * 100,
        missRate: cacheMissRate * 100,
        totalHits: Math.floor(this.requestCount * cacheHitRate),
        totalMisses: Math.floor(this.requestCount * cacheMissRate),
      },
      edge: edgeStats,
      cdn: cdnStats,
      geographic: geoStats,
      errors: {
        total: this.errorCount,
        rate: errorRate,
        byType: { ...this.errorsByType },
      },
    };
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  private checkAlerts(metrics: EdgeMetrics): void {
    const config = this.configService.get('edge');
    const alertThreshold = config?.monitoring?.alertThreshold || 200;

    // Check for slow response times
    if (metrics.responseTime.p95 > alertThreshold) {
      this.createAlert({
        type: 'slow_response',
        severity: metrics.responseTime.p95 > alertThreshold * 1.5 ? 'critical' : 'warning',
        message: `P95 response time (${metrics.responseTime.p95.toFixed(2)}ms) exceeds threshold (${alertThreshold}ms)`,
        metric: 'response_time_p95',
        value: metrics.responseTime.p95,
        threshold: alertThreshold,
      });
    }

    // Check for high error rate
    if (metrics.errors.rate > 5) {
      this.createAlert({
        type: 'high_error_rate',
        severity: metrics.errors.rate > 10 ? 'critical' : 'warning',
        message: `Error rate (${metrics.errors.rate.toFixed(2)}%) exceeds threshold (5%)`,
        metric: 'error_rate',
        value: metrics.errors.rate,
        threshold: 5,
      });
    }

    // Check for low cache hit rate
    if (metrics.cache.hitRate < 50) {
      this.createAlert({
        type: 'low_cache_hit',
        severity: metrics.cache.hitRate < 30 ? 'critical' : 'warning',
        message: `Cache hit rate (${metrics.cache.hitRate.toFixed(2)}%) below threshold (50%)`,
        metric: 'cache_hit_rate',
        value: metrics.cache.hitRate,
        threshold: 50,
      });
    }

    // Check for edge node failures
    if (metrics.edge.healthyNodes < metrics.edge.totalNodes * 0.5) {
      this.createAlert({
        type: 'edge_failure',
        severity: 'critical',
        message: `Only ${metrics.edge.healthyNodes}/${metrics.edge.totalNodes} edge nodes healthy`,
        metric: 'healthy_edge_nodes',
        value: metrics.edge.healthyNodes,
        threshold: metrics.edge.totalNodes * 0.5,
      });
    }

    // Check for region failures
    if (metrics.geographic.healthyRegions < metrics.geographic.totalRegions * 0.5) {
      this.createAlert({
        type: 'region_failure',
        severity: 'critical',
        message: `Only ${metrics.geographic.healthyRegions}/${metrics.geographic.totalRegions} regions healthy`,
        metric: 'healthy_regions',
        value: metrics.geographic.healthyRegions,
        threshold: metrics.geographic.totalRegions * 0.5,
      });
    }
  }

  private createAlert(alertData: Omit<PerformanceAlert, 'id' | 'timestamp'>): void {
    const alert: PerformanceAlert = {
      ...alertData,
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    this.alerts.push(alert);
    
    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    this.logger.warn(`Performance alert: ${alert.message}`);
  }

  recordResponseTime(time: number): void {
    this.responseTimes.push(time);
    this.requestCount++;
    
    // Keep only last 10000 response times
    if (this.responseTimes.length > 10000) {
      this.responseTimes = this.responseTimes.slice(-10000);
    }
  }

  recordError(type: string): void {
    this.errorCount++;
    this.errorsByType[type] = (this.errorsByType[type] || 0) + 1;
  }

  async getMetrics(limit: number = 100): Promise<EdgeMetrics[]> {
    return this.metrics.slice(-limit);
  }

  async getLatestMetrics(): Promise<EdgeMetrics | null> {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  async getAlerts(limit: number = 50): Promise<PerformanceAlert[]> {
    return this.alerts.slice(-limit);
  }

  async getActiveAlerts(): Promise<PerformanceAlert[]> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return this.alerts.filter(alert => alert.timestamp > fiveMinutesAgo);
  }

  async getMetricsSummary(): Promise<{
    averageResponseTime: number;
    p95ResponseTime: number;
    errorRate: number;
    cacheHitRate: number;
    totalRequests: number;
    activeAlerts: number;
  }> {
    const latest = await this.getLatestMetrics();
    const activeAlerts = await this.getActiveAlerts();

    return {
      averageResponseTime: latest?.responseTime.average || 0,
      p95ResponseTime: latest?.responseTime.p95 || 0,
      errorRate: latest?.errors.rate || 0,
      cacheHitRate: latest?.cache.hitRate || 0,
      totalRequests: this.requestCount,
      activeAlerts: activeAlerts.length,
    };
  }

  async getPerformanceReport(): Promise<{
    summary: any;
    trends: {
      responseTime: { improving: boolean; change: number };
      errorRate: { improving: boolean; change: number };
      cacheHitRate: { improving: boolean; change: number };
    };
    recommendations: string[];
  }> {
    const summary = await this.getMetricsSummary();
    const recommendations: string[] = [];

    // Generate recommendations based on metrics
    if (summary.p95ResponseTime > 150) {
      recommendations.push('Consider increasing edge cache TTL for frequently accessed endpoints');
    }

    if (summary.errorRate > 2) {
      recommendations.push('Investigate and fix recurring errors to improve reliability');
    }

    if (summary.cacheHitRate < 60) {
      recommendations.push('Review cache warming strategy and increase cache coverage');
    }

    return {
      summary,
      trends: {
        responseTime: { improving: true, change: -5 },
        errorRate: { improving: true, change: -1 },
        cacheHitRate: { improving: true, change: 3 },
      },
      recommendations,
    };
  }

  async clearAlerts(): Promise<void> {
    this.alerts = [];
    this.logger.log('Cleared all alerts');
  }

  async resetMetrics(): Promise<void> {
    this.metrics = [];
    this.responseTimes = [];
    this.requestCount = 0;
    this.errorCount = 0;
    this.errorsByType = {};
    this.logger.log('Reset all metrics');
  }

  destroy(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }
}

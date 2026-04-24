import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { QueryPerformanceService } from '../../database/services/query-performance.service';
import { IndexOptimizationService } from '../../database/services/index-optimization.service';
import { MemoryProfilingService } from '../../graphql/services/memory-profiling.service';
import { EnhancedCacheService } from '../../common/services/enhanced-cache.service';

interface PerformanceMetrics {
  timestamp: Date;
  database: {
    slowQueries: number;
    averageQueryTime: number;
    indexUsage: number;
    recommendations: string[];
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    memoryIntensiveOperations: number;
  };
  cache: {
    hitRate: number;
    totalHits: number;
    totalMisses: number;
    keyCount: number;
  };
  websocket: {
    activeConnections: number;
    messageQueueSize: number;
    messagesPerSecond: number;
  };
  system: {
    cpuUsage: number;
    memoryUsage: number;
    uptime: number;
  };
}

interface BenchmarkResult {
  name: string;
  category: 'database' | 'graphql' | 'cache' | 'websocket';
  targetValue: number;
  actualValue: number;
  status: 'pass' | 'fail' | 'warning';
  threshold: {
    pass: number;
    warning: number;
  };
  timestamp: Date;
}

@Injectable()
export class PerformanceMonitoringService {
  private readonly logger = new Logger(PerformanceMonitoringService.name);
  private metrics: PerformanceMetrics[] = [];
  private benchmarks: BenchmarkResult[] = [];
  private readonly MAX_METRICS_HISTORY = 1000;

  constructor(
    private readonly queryPerformanceService: QueryPerformanceService,
    private readonly indexOptimizationService: IndexOptimizationService,
    private readonly memoryProfilingService: MemoryProfilingService,
    private readonly cacheService: EnhancedCacheService
  ) {}

  /**
   * Collect performance metrics every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async collectMetrics(): Promise<void> {
    try {
      const metrics = await this.gatherMetrics();
      this.metrics.push(metrics);

      // Keep only recent metrics
      if (this.metrics.length > this.MAX_METRICS_HISTORY) {
        this.metrics = this.metrics.slice(-this.MAX_METRICS_HISTORY);
      }

      // Run benchmarks
      await this.runBenchmarks(metrics);

      // Check for performance alerts
      this.checkPerformanceAlerts(metrics);

      this.logger.debug('Performance metrics collected', {
        timestamp: metrics.timestamp,
        databaseSlowQueries: metrics.database.slowQueries,
        memoryHeapUsed: Math.round(metrics.memory.heapUsed / 1024 / 1024),
        cacheHitRate: metrics.cache.hitRate
      });

    } catch (error) {
      this.logger.error('Error collecting performance metrics:', error);
    }
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(hours: number = 24): PerformanceMetrics[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.metrics.filter(m => m.timestamp >= cutoff);
  }

  /**
   * Get benchmark results
   */
  getBenchmarkResults(): BenchmarkResult[] {
    return this.benchmarks.slice(-100); // Last 100 benchmarks
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    overallStatus: 'healthy' | 'warning' | 'critical';
    criticalIssues: string[];
    warnings: string[];
    recommendations: string[];
  } {
    const latestMetrics = this.getCurrentMetrics();
    if (!latestMetrics) {
      return {
        overallStatus: 'healthy',
        criticalIssues: [],
        warnings: [],
        recommendations: []
      };
    }

    const criticalIssues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Database checks
    if (latestMetrics.database.slowQueries > 10) {
      criticalIssues.push(`High number of slow queries: ${latestMetrics.database.slowQueries}`);
    }

    if (latestMetrics.database.averageQueryTime > 100) {
      warnings.push(`Average query time above target: ${latestMetrics.database.averageQueryTime}ms`);
    }

    // Memory checks
    const heapUsedMB = latestMetrics.memory.heapUsed / 1024 / 1024;
    if (heapUsedMB > 1000) {
      criticalIssues.push(`High memory usage: ${heapUsedMB.toFixed(0)}MB`);
    } else if (heapUsedMB > 500) {
      warnings.push(`Moderate memory usage: ${heapUsedMB.toFixed(0)}MB`);
    }

    // Cache checks
    if (latestMetrics.cache.hitRate < 70) {
      warnings.push(`Low cache hit rate: ${latestMetrics.cache.hitRate.toFixed(1)}%`);
    }

    // WebSocket checks
    if (latestMetrics.websocket.messageQueueSize > 1000) {
      warnings.push(`High message queue size: ${latestMetrics.websocket.messageQueueSize}`);
    }

    // Generate recommendations
    if (latestMetrics.database.recommendations.length > 0) {
      recommendations.push(...latestMetrics.database.recommendations);
    }

    if (latestMetrics.memory.memoryIntensiveOperations > 5) {
      recommendations.push('Consider optimizing memory-intensive GraphQL operations');
    }

    // Determine overall status
    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (criticalIssues.length > 0) {
      overallStatus = 'critical';
    } else if (warnings.length > 0) {
      overallStatus = 'warning';
    }

    return {
      overallStatus,
      criticalIssues,
      warnings,
      recommendations
    };
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(): {
    summary: any;
    trends: any;
    benchmarks: BenchmarkResult[];
    recommendations: string[];
  } {
    const summary = this.getPerformanceSummary();
    const trends = this.analyzeTrends();

    return {
      summary,
      trends,
      benchmarks: this.getBenchmarkResults(),
      recommendations: summary.recommendations
    };
  }

  /**
   * Gather all performance metrics
   */
  private async gatherMetrics(): Promise<PerformanceMetrics> {
    const queryMetrics = this.queryPerformanceService.getPerformanceMetrics();
    const memoryStats = this.memoryProfilingService.getMemoryStats();
    const cacheStats = this.cacheService.getCacheStats();
    const systemMetrics = this.getSystemMetrics();

    return {
      timestamp: new Date(),
      database: {
        slowQueries: queryMetrics.slowQueries,
        averageQueryTime: queryMetrics.averageDuration,
        indexUsage: this.calculateIndexUsage(queryMetrics),
        recommendations: this.generateDatabaseRecommendations(queryMetrics)
      },
      memory: {
        heapUsed: systemMetrics.heapUsed,
        heapTotal: systemMetrics.heapTotal,
        external: systemMetrics.external,
        rss: systemMetrics.rss,
        memoryIntensiveOperations: memoryStats.memoryIntensiveOperations.length
      },
      cache: {
        hitRate: cacheStats.hitRate,
        totalHits: cacheStats.hits,
        totalMisses: cacheStats.misses,
        keyCount: cacheStats.keyCount
      },
      websocket: {
        activeConnections: 0, // Would get from WebSocket gateway
        messageQueueSize: 0, // Would get from message queue
        messagesPerSecond: this.calculateMessagesPerSecond()
      },
      system: {
        cpuUsage: systemMetrics.cpuUsage,
        memoryUsage: (systemMetrics.heapUsed / systemMetrics.heapTotal) * 100,
        uptime: process.uptime()
      }
    };
  }

  /**
   * Run performance benchmarks
   */
  private async runBenchmarks(metrics: PerformanceMetrics): Promise<void> {
    const benchmarks: Omit<BenchmarkResult, 'timestamp'>[] = [
      {
        name: 'Database Query Performance',
        category: 'database',
        targetValue: 50,
        actualValue: metrics.database.averageQueryTime,
        status: 'pass',
        threshold: { pass: 50, warning: 100 }
      },
      {
        name: 'Cache Hit Rate',
        category: 'cache',
        targetValue: 80,
        actualValue: metrics.cache.hitRate,
        status: 'pass',
        threshold: { pass: 80, warning: 70 }
      },
      {
        name: 'Memory Usage',
        category: 'graphql',
        targetValue: 500,
        actualValue: metrics.memory.heapUsed / 1024 / 1024,
        status: 'pass',
        threshold: { pass: 500, warning: 1000 }
      }
    ];

    // Update benchmark status based on thresholds
    benchmarks.forEach(benchmark => {
      if (benchmark.actualValue <= benchmark.threshold.pass) {
        benchmark.status = 'pass';
      } else if (benchmark.actualValue <= benchmark.threshold.warning) {
        benchmark.status = 'warning';
      } else {
        benchmark.status = 'fail';
      }
    });

    // Add timestamp and store
    benchmarks.forEach(benchmark => {
      this.benchmarks.push({
        ...benchmark,
        timestamp: new Date()
      });
    });

    // Keep only recent benchmarks
    if (this.benchmarks.length > 1000) {
      this.benchmarks = this.benchmarks.slice(-1000);
    }
  }

  /**
   * Check for performance alerts
   */
  private checkPerformanceAlerts(metrics: PerformanceMetrics): void {
    // Database alerts
    if (metrics.database.slowQueries > 20) {
      this.logger.warn(`CRITICAL: High number of slow queries (${metrics.database.slowQueries})`);
    }

    // Memory alerts
    const heapUsedMB = metrics.memory.heapUsed / 1024 / 1024;
    if (heapUsedMB > 1500) {
      this.logger.error(`CRITICAL: Very high memory usage (${heapUsedMB.toFixed(0)}MB)`);
    }

    // Cache alerts
    if (metrics.cache.hitRate < 50) {
      this.logger.warn(`WARNING: Very low cache hit rate (${metrics.cache.hitRate.toFixed(1)}%)`);
    }
  }

  /**
   * Analyze performance trends
   */
  private analyzeTrends(): any {
    if (this.metrics.length < 10) {
      return { message: 'Insufficient data for trend analysis' };
    }

    const recent = this.metrics.slice(-10);
    const older = this.metrics.slice(-20, -10);

    return {
      databaseQueryTime: this.calculateTrend(
        older.map(m => m.database.averageQueryTime),
        recent.map(m => m.database.averageQueryTime)
      ),
      memoryUsage: this.calculateTrend(
        older.map(m => m.memory.heapUsed),
        recent.map(m => m.memory.heapUsed)
      ),
      cacheHitRate: this.calculateTrend(
        older.map(m => m.cache.hitRate),
        recent.map(m => m.cache.hitRate)
      )
    };
  }

  /**
   * Calculate trend between two datasets
   */
  private calculateTrend(older: number[], recent: number[]): {
    direction: 'improving' | 'degrading' | 'stable';
    changePercent: number;
  } {
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    
    const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    let direction: 'improving' | 'degrading' | 'stable';
    if (Math.abs(changePercent) < 5) {
      direction = 'stable';
    } else if (changePercent > 0) {
      direction = 'degrading';
    } else {
      direction = 'improving';
    }

    return { direction, changePercent };
  }

  /**
   * Get system metrics
   */
  private getSystemMetrics(): any {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to milliseconds
    };
  }

  /**
   * Calculate index usage (mock implementation)
   */
  private calculateIndexUsage(queryMetrics: any): number {
    // This would analyze query execution plans
    return 85; // Mock value
  }

  /**
   * Generate database recommendations
   */
  private generateDatabaseRecommendations(queryMetrics: any): string[] {
    const recommendations: string[] = [];
    
    if (queryMetrics.slowQueries > 5) {
      recommendations.push('Consider adding indexes for frequently queried columns');
    }
    
    if (queryMetrics.averageDuration > 100) {
      recommendations.push('Optimize slow queries using EXPLAIN ANALYZE');
    }
    
    return recommendations;
  }

  /**
   * Calculate messages per second (mock implementation)
   */
  private calculateMessagesPerSecond(): number {
    // This would track actual message rates
    return Math.floor(Math.random() * 100) + 50; // Mock 50-150 msg/s
  }
}

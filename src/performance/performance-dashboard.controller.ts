import { Controller, Get, Query } from '@nestjs/common';
import { PerformanceMonitoringService } from './services/performance-monitoring.service';
import { QueryPerformanceService } from '../database/services/query-performance.service';
import { IndexOptimizationService } from '../database/services/index-optimization.service';
import { MemoryProfilingService } from '../graphql/services/memory-profiling.service';
import { EnhancedCacheService } from '../common/services/enhanced-cache.service';

@Controller('performance')
export class PerformanceDashboardController {
  constructor(
    private readonly performanceMonitoringService: PerformanceMonitoringService,
    private readonly queryPerformanceService: QueryPerformanceService,
    private readonly indexOptimizationService: IndexOptimizationService,
    private readonly memoryProfilingService: MemoryProfilingService,
    private readonly cacheService: EnhancedCacheService
  ) {}

  @Get('dashboard')
  getPerformanceDashboard() {
    const summary = this.performanceMonitoringService.getPerformanceSummary();
    const currentMetrics = this.performanceMonitoringService.getCurrentMetrics();
    const benchmarks = this.performanceMonitoringService.getBenchmarkResults();

    return {
      status: summary.overallStatus,
      summary,
      currentMetrics,
      recentBenchmarks: benchmarks.slice(-10),
      timestamp: new Date().toISOString()
    };
  }

  @Get('metrics')
  getMetrics(@Query('hours') hours?: number) {
    const history = this.performanceMonitoringService.getMetricsHistory(
      hours ? parseInt(hours) : 24
    );
    
    return {
      history,
      summary: this.performanceMonitoringService.getPerformanceSummary(),
      timestamp: new Date().toISOString()
    };
  }

  @Get('database')
  getDatabasePerformance() {
    const queryMetrics = this.queryPerformanceService.getPerformanceMetrics();
    const indexAnalysis = this.indexOptimizationService.analyzeIndexes();
    const recommendations = this.queryPerformanceService.analyzeQueryPatterns();

    return {
      queries: queryMetrics,
      indexes: indexAnalysis,
      recommendations,
      timestamp: new Date().toISOString()
    };
  }

  @Get('memory')
  getMemoryPerformance() {
    const memoryStats = this.memoryProfilingService.getMemoryStats();
    const memoryIntensiveOps = memoryStats.memoryIntensiveOperations;

    return {
      stats: memoryStats,
      intensiveOperations: memoryIntensiveOps,
      recommendations: memoryStats.recommendations,
      timestamp: new Date().toISOString()
    };
  }

  @Get('cache')
  getCachePerformance() {
    const cacheStats = this.cacheService.getCacheStats();

    return {
      stats: cacheStats,
      hitRate: cacheStats.hitRate,
      efficiency: cacheStats.hitRate > 80 ? 'excellent' : 
                  cacheStats.hitRate > 70 ? 'good' : 
                  cacheStats.hitRate > 50 ? 'fair' : 'poor',
      timestamp: new Date().toISOString()
    };
  }

  @Get('benchmarks')
  getBenchmarks() {
    const benchmarks = this.performanceMonitoringService.getBenchmarkResults();
    const summary = this.performanceMonitoringService.getPerformanceSummary();

    // Calculate pass rates
    const totalBenchmarks = benchmarks.length;
    const passedBenchmarks = benchmarks.filter(b => b.status === 'pass').length;
    const warningBenchmarks = benchmarks.filter(b => b.status === 'warning').length;
    const failedBenchmarks = benchmarks.filter(b => b.status === 'fail').length;

    return {
      summary: {
        total: totalBenchmarks,
        passed: passedBenchmarks,
        warnings: warningBenchmarks,
        failed: failedBenchmarks,
        passRate: totalBenchmarks > 0 ? (passedBenchmarks / totalBenchmarks) * 100 : 0
      },
      benchmarks: benchmarks.slice(-50), // Last 50 benchmarks
      categories: this.groupBenchmarksByCategory(benchmarks),
      timestamp: new Date().toISOString()
    };
  }

  @Get('report')
  generatePerformanceReport() {
    return this.performanceMonitoringService.generatePerformanceReport();
  }

  @Get('health')
  getHealthStatus() {
    const summary = this.performanceMonitoringService.getPerformanceSummary();
    const currentMetrics = this.performanceMonitoringService.getCurrentMetrics();

    return {
      status: summary.overallStatus,
      uptime: process.uptime(),
      memory: {
        used: Math.round((currentMetrics?.memory.heapUsed || 0) / 1024 / 1024),
        total: Math.round((currentMetrics?.memory.heapTotal || 0) / 1024 / 1024),
        usage: currentMetrics ? currentMetrics.system.memoryUsage : 0
      },
      database: {
        slowQueries: currentMetrics?.database.slowQueries || 0,
        avgQueryTime: currentMetrics?.database.averageQueryTime || 0
      },
      cache: {
        hitRate: currentMetrics?.cache.hitRate || 0
      },
      issues: {
        critical: summary.criticalIssues.length,
        warnings: summary.warnings.length
      },
      timestamp: new Date().toISOString()
    };
  }

  @Get('optimize')
  async triggerOptimization() {
    const results = {
      database: await this.optimizeDatabase(),
      cache: await this.optimizeCache(),
      memory: await this.optimizeMemory()
    };

    return {
      results,
      message: 'Optimization completed',
      timestamp: new Date().toISOString()
    };
  }

  private async optimizeDatabase(): Promise<any> {
    try {
      const indexAnalysis = await this.indexOptimizationService.analyzeIndexes();
      
      // Apply high-priority index recommendations
      const highPriorityIndexes = indexAnalysis.recommendations.filter(
        rec => rec.priority === 'high'
      );
      
      if (highPriorityIndexes.length > 0) {
        await this.indexOptimizationService.createRecommendedIndexes(highPriorityIndexes);
      }

      return {
        indexesCreated: highPriorityIndexes.length,
        recommendations: indexAnalysis.recommendations.length,
        status: 'completed'
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  private async optimizeCache(): Promise<any> {
    try {
      // Clear cache statistics
      this.cacheService.resetStats();
      
      // Warm up cache with common data
      await this.cacheService.warmupCache();

      return {
        status: 'completed',
        actions: ['stats_cleared', 'cache_warmed']
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  private async optimizeMemory(): Promise<any> {
    try {
      // Clear memory profiling history
      this.memoryProfilingService.clearProfiles();

      // Trigger garbage collection if available
      if (global.gc) {
        global.gc();
      }

      return {
        status: 'completed',
        actions: ['profiles_cleared', 'garbage_collected']
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  private groupBenchmarksByCategory(benchmarks: any[]): any {
    const categories = {
      database: { pass: 0, warning: 0, fail: 0 },
      graphql: { pass: 0, warning: 0, fail: 0 },
      cache: { pass: 0, warning: 0, fail: 0 },
      websocket: { pass: 0, warning: 0, fail: 0 }
    };

    benchmarks.forEach(benchmark => {
      if (categories[benchmark.category]) {
        categories[benchmark.category][benchmark.status]++;
      }
    });

    return categories;
  }
}

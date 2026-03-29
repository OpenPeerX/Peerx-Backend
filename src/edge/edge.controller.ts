import { Controller, Get, Post, Body, Query, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { EdgeComputingService } from './edge-computing.service';
import { CdnIntegrationService } from './cdn-integration.service';
import { ResponseOptimizationService } from './response-optimization.service';
import { EdgeCacheService } from './edge-cache.service';
import { RequestDeduplicationService } from './request-deduplication.service';
import { GeographicDistributionService } from './geographic-distribution.service';
import { EdgeMetricsService } from './edge-metrics.service';

@ApiTags('edge')
@Controller('edge')
export class EdgeController {
  constructor(
    private readonly edgeComputingService: EdgeComputingService,
    private readonly cdnIntegrationService: CdnIntegrationService,
    private readonly responseOptimizationService: ResponseOptimizationService,
    private readonly edgeCacheService: EdgeCacheService,
    private readonly requestDeduplicationService: RequestDeduplicationService,
    private readonly geographicDistributionService: GeographicDistributionService,
    private readonly edgeMetricsService: EdgeMetricsService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Get edge computing status' })
  @ApiResponse({ status: 200, description: 'Edge computing status retrieved successfully' })
  async getStatus() {
    const [edgeHealth, regions, cacheStats, metrics] = await Promise.all([
      this.edgeComputingService.healthCheck(),
      this.geographicDistributionService.getAllRegions(),
      this.edgeCacheService.getStats(),
      this.edgeMetricsService.getLatestMetrics(),
    ]);

    return {
      success: true,
      data: {
        edge: edgeHealth,
        regions: regions.length,
        healthyRegions: regions.filter(r => r.healthy).length,
        cache: cacheStats,
        metrics: metrics ? {
          responseTime: metrics.responseTime,
          throughput: metrics.throughput,
          errors: metrics.errors,
        } : null,
      },
    };
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get edge metrics' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Metrics retrieved successfully' })
  async getMetrics(@Query('limit') limit?: number) {
    const metrics = await this.edgeMetricsService.getMetrics(limit || 100);
    return {
      success: true,
      data: metrics,
    };
  }

  @Get('metrics/latest')
  @ApiOperation({ summary: 'Get latest edge metrics' })
  @ApiResponse({ status: 200, description: 'Latest metrics retrieved successfully' })
  async getLatestMetrics() {
    const metrics = await this.edgeMetricsService.getLatestMetrics();
    return {
      success: true,
      data: metrics,
    };
  }

  @Get('metrics/summary')
  @ApiOperation({ summary: 'Get metrics summary' })
  @ApiResponse({ status: 200, description: 'Metrics summary retrieved successfully' })
  async getMetricsSummary() {
    const summary = await this.edgeMetricsService.getMetricsSummary();
    return {
      success: true,
      data: summary,
    };
  }

  @Get('metrics/report')
  @ApiOperation({ summary: 'Get performance report' })
  @ApiResponse({ status: 200, description: 'Performance report retrieved successfully' })
  async getPerformanceReport() {
    const report = await this.edgeMetricsService.getPerformanceReport();
    return {
      success: true,
      data: report,
    };
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Get performance alerts' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Alerts retrieved successfully' })
  async getAlerts(@Query('limit') limit?: number) {
    const alerts = await this.edgeMetricsService.getAlerts(limit || 50);
    return {
      success: true,
      data: alerts,
    };
  }

  @Get('alerts/active')
  @ApiOperation({ summary: 'Get active alerts' })
  @ApiResponse({ status: 200, description: 'Active alerts retrieved successfully' })
  async getActiveAlerts() {
    const alerts = await this.edgeMetricsService.getActiveAlerts();
    return {
      success: true,
      data: alerts,
    };
  }

  @Post('alerts/clear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear all alerts' })
  @ApiResponse({ status: 200, description: 'Alerts cleared successfully' })
  async clearAlerts() {
    await this.edgeMetricsService.clearAlerts();
    return {
      success: true,
      message: 'Alerts cleared successfully',
    };
  }

  @Post('metrics/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset all metrics' })
  @ApiResponse({ status: 200, description: 'Metrics reset successfully' })
  async resetMetrics() {
    await this.edgeMetricsService.resetMetrics();
    return {
      success: true,
      message: 'Metrics reset successfully',
    };
  }

  @Get('edge-nodes')
  @ApiOperation({ summary: 'Get edge node status' })
  @ApiResponse({ status: 200, description: 'Edge nodes retrieved successfully' })
  async getEdgeNodes() {
    const nodes = await this.edgeComputingService.getEdgeNodeStatus();
    return {
      success: true,
      data: nodes,
    };
  }

  @Get('edge-nodes/metrics')
  @ApiOperation({ summary: 'Get edge node metrics' })
  @ApiResponse({ status: 200, description: 'Edge node metrics retrieved successfully' })
  async getEdgeNodeMetrics() {
    const metrics = await this.edgeComputingService.getMetrics();
    return {
      success: true,
      data: metrics,
    };
  }

  @Post('edge-nodes/:nodeId/health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update edge node health' })
  @ApiResponse({ status: 200, description: 'Edge node health updated successfully' })
  async updateEdgeNodeHealth(
    @Param('nodeId') nodeId: string,
    @Body('healthy') healthy: boolean,
  ) {
    await this.edgeComputingService.updateEdgeNodeHealth(nodeId, healthy);
    return {
      success: true,
      message: `Edge node ${nodeId} health updated to ${healthy}`,
    };
  }

  @Get('regions')
  @ApiOperation({ summary: 'Get geographic regions' })
  @ApiResponse({ status: 200, description: 'Regions retrieved successfully' })
  async getRegions() {
    const regions = await this.geographicDistributionService.getAllRegions();
    return {
      success: true,
      data: regions,
    };
  }

  @Get('regions/healthy')
  @ApiOperation({ summary: 'Get healthy regions' })
  @ApiResponse({ status: 200, description: 'Healthy regions retrieved successfully' })
  async getHealthyRegions() {
    const regions = await this.geographicDistributionService.getHealthyRegions();
    return {
      success: true,
      data: regions,
    };
  }

  @Get('regions/stats')
  @ApiOperation({ summary: 'Get region statistics' })
  @ApiResponse({ status: 200, description: 'Region statistics retrieved successfully' })
  async getRegionStats() {
    const stats = await this.geographicDistributionService.getRegionStats();
    return {
      success: true,
      data: stats,
    };
  }

  @Post('regions/:regionId/health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set region health' })
  @ApiResponse({ status: 200, description: 'Region health updated successfully' })
  async setRegionHealth(
    @Param('regionId') regionId: string,
    @Body('healthy') healthy: boolean,
  ) {
    await this.geographicDistributionService.setRegionHealth(regionId, healthy);
    return {
      success: true,
      message: `Region ${regionId} health updated to ${healthy}`,
    };
  }

  @Get('cache/stats')
  @ApiOperation({ summary: 'Get edge cache statistics' })
  @ApiResponse({ status: 200, description: 'Cache statistics retrieved successfully' })
  async getCacheStats() {
    const stats = await this.edgeCacheService.getStats();
    return {
      success: true,
      data: stats,
    };
  }

  @Get('cache/memory')
  @ApiOperation({ summary: 'Get cache memory usage' })
  @ApiResponse({ status: 200, description: 'Cache memory usage retrieved successfully' })
  async getCacheMemory() {
    const memory = await this.edgeCacheService.getMemoryUsage();
    return {
      success: true,
      data: memory,
    };
  }

  @Post('cache/clear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear edge cache' })
  @ApiResponse({ status: 200, description: 'Cache cleared successfully' })
  async clearCache() {
    await this.edgeCacheService.clear();
    return {
      success: true,
      message: 'Edge cache cleared successfully',
    };
  }

  @Post('cache/evict/least-used')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Evict least used cache entries' })
  @ApiResponse({ status: 200, description: 'Cache entries evicted successfully' })
  async evictLeastUsed(@Body('count') count: number) {
    const evicted = await this.edgeCacheService.evictLeastUsed(count || 10);
    return {
      success: true,
      message: `Evicted ${evicted} least used cache entries`,
    };
  }

  @Post('cache/evict/oldest')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Evict oldest cache entries' })
  @ApiResponse({ status: 200, description: 'Cache entries evicted successfully' })
  async evictOldest(@Body('count') count: number) {
    const evicted = await this.edgeCacheService.evictOldest(count || 10);
    return {
      success: true,
      message: `Evicted ${evicted} oldest cache entries`,
    };
  }

  @Get('cdn/metrics')
  @ApiOperation({ summary: 'Get CDN metrics' })
  @ApiResponse({ status: 200, description: 'CDN metrics retrieved successfully' })
  async getCdnMetrics() {
    const metrics = await this.cdnIntegrationService.getMetrics();
    return {
      success: true,
      data: metrics,
    };
  }

  @Get('cdn/rules')
  @ApiOperation({ summary: 'Get CDN cache rules' })
  @ApiResponse({ status: 200, description: 'CDN cache rules retrieved successfully' })
  async getCdnRules() {
    const rules = this.cdnIntegrationService.getCacheRules();
    return {
      success: true,
      data: rules,
    };
  }

  @Post('cdn/purge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Purge CDN cache' })
  @ApiResponse({ status: 200, description: 'CDN cache purged successfully' })
  async purgeCdnCache(
    @Body() purgeRequest: { urls?: string[]; tags?: string[]; purgeAll?: boolean },
  ) {
    const result = await this.cdnIntegrationService.purgeCache(purgeRequest);
    return {
      success: result.success,
      message: `Purged ${result.purged} items from CDN cache`,
    };
  }

  @Post('cdn/preload')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Preload CDN cache' })
  @ApiResponse({ status: 200, description: 'CDN cache preloaded successfully' })
  async preloadCdnCache(@Body('urls') urls: string[]) {
    const result = await this.cdnIntegrationService.preloadCache(urls || []);
    return {
      success: result.success,
      message: `Preloaded ${result.preloaded} URLs into CDN cache`,
    };
  }

  @Get('deduplication/stats')
  @ApiOperation({ summary: 'Get request deduplication statistics' })
  @ApiResponse({ status: 200, description: 'Deduplication statistics retrieved successfully' })
  async getDeduplicationStats() {
    const stats = await this.requestDeduplicationService.getStats();
    return {
      success: true,
      data: stats,
    };
  }

  @Get('deduplication/pending')
  @ApiOperation({ summary: 'Get pending deduplicated requests' })
  @ApiResponse({ status: 200, description: 'Pending requests retrieved successfully' })
  async getPendingRequests() {
    const requests = await this.requestDeduplicationService.getPendingRequests();
    return {
      success: true,
      data: requests,
    };
  }

  @Post('deduplication/clear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear request deduplication service' })
  @ApiResponse({ status: 200, description: 'Deduplication service cleared successfully' })
  async clearDeduplication() {
    await this.requestDeduplicationService.clear();
    return {
      success: true,
      message: 'Request deduplication service cleared',
    };
  }

  @Get('optimization/stats')
  @ApiOperation({ summary: 'Get response optimization statistics' })
  @ApiResponse({ status: 200, description: 'Optimization statistics retrieved successfully' })
  async getOptimizationStats() {
    const stats = this.responseOptimizationService.getCompressionStats();
    return {
      success: true,
      data: stats,
    };
  }

  @Get('routing/optimal')
  @ApiOperation({ summary: 'Get optimal endpoint for client' })
  @ApiQuery({ name: 'latitude', required: false, type: Number })
  @ApiQuery({ name: 'longitude', required: false, type: Number })
  @ApiQuery({ name: 'country', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Optimal endpoint retrieved successfully' })
  async getOptimalEndpoint(
    @Query('latitude') latitude?: number,
    @Query('longitude') longitude?: number,
    @Query('country') country?: string,
  ) {
    const endpoint = await this.geographicDistributionService.getOptimalEndpoint({
      latitude,
      longitude,
      country,
    });
    return {
      success: true,
      data: { endpoint },
    };
  }
}

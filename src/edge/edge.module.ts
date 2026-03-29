import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EdgeComputingService } from './edge-computing.service';
import { CdnIntegrationService } from './cdn-integration.service';
import { ResponseOptimizationService } from './response-optimization.service';
import { EdgeCacheService } from './edge-cache.service';
import { RequestDeduplicationService } from './request-deduplication.service';
import { GeographicDistributionService } from './geographic-distribution.service';
import { EdgeMetricsService } from './edge-metrics.service';
import { EdgeController } from './edge.controller';
import edgeConfig from '../common/config/edge.config';

@Global()
@Module({
  imports: [ConfigModule.forFeature(edgeConfig)],
  controllers: [EdgeController],
  providers: [
    EdgeComputingService,
    CdnIntegrationService,
    ResponseOptimizationService,
    EdgeCacheService,
    RequestDeduplicationService,
    GeographicDistributionService,
    EdgeMetricsService,
  ],
  exports: [
    EdgeComputingService,
    CdnIntegrationService,
    ResponseOptimizationService,
    EdgeCacheService,
    RequestDeduplicationService,
    GeographicDistributionService,
    EdgeMetricsService,
  ],
})
export class EdgeModule {}

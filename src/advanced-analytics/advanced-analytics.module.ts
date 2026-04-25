import { Module } from '@nestjs/common';
import { AdvancedAnalyticsController } from './controllers/advanced-analytics.controller';
import { AdvancedAnalyticsService } from './advanced-analytics.service';
import { ComputeBridgeService } from './compute-bridge.service';

@Module({
  controllers: [AdvancedAnalyticsController],
  providers: [AdvancedAnalyticsService, ComputeBridgeService],
  exports: [AdvancedAnalyticsService, ComputeBridgeService],
})
export class AdvancedAnalyticsModule {}

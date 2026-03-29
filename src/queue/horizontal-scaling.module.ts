// src/queue/horizontal-scaling.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { QueueWorkerManagerService } from './queue-worker-manager.service';
import { QueueLoadBalancerService } from './queue-load-balancer.service';
import { QueueFaultToleranceService } from './queue-fault-tolerance.service';
import { MessageDeduplicationService } from './message-deduplication.service';
import { MessageOrderingService } from './message-ordering.service';
import { DynamicScalingService } from './dynamic-scaling.service';
import { HorizontalScalingMonitoringService } from './horizontal-scaling-monitoring.service';
import { ZeroLossMessageService } from './zero-loss-message.service';
import { LoadTestingService } from './load-testing.service';
import { HorizontalScalingController } from './horizontal-scaling.controller';

/**
 * Horizontal Scaling Module
 * Provides comprehensive horizontal scaling capabilities for queue processing
 */
@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
  ],
  controllers: [HorizontalScalingController],
  providers: [
    QueueWorkerManagerService,
    QueueLoadBalancerService,
    QueueFaultToleranceService,
    MessageDeduplicationService,
    MessageOrderingService,
    DynamicScalingService,
    HorizontalScalingMonitoringService,
    ZeroLossMessageService,
    LoadTestingService,
  ],
  exports: [
    QueueWorkerManagerService,
    QueueLoadBalancerService,
    QueueFaultToleranceService,
    MessageDeduplicationService,
    MessageOrderingService,
    DynamicScalingService,
    HorizontalScalingMonitoringService,
    ZeroLossMessageService,
    LoadTestingService,
  ],
})
export class HorizontalScalingModule {}

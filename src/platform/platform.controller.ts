import { Controller, Get } from '@nestjs/common';
import { AuditService } from './audit.service';
import { MobileMetricsService } from './mobile-metrics.service';

@Controller()
export class PlatformController {
  constructor(
    private readonly auditService: AuditService,
    private readonly mobileMetricsService: MobileMetricsService,
  ) {}

  @Get('health')
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('metrics/mobile')
  mobileMetrics() {
    return this.mobileMetricsService.summary();
  }

  @Get('audit')
  async auditTrail() {
    return this.auditService.list();
  }
}

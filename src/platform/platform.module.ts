import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditEntry } from './entities/audit-entry.entity';
import { AuditService } from './audit.service';
import { MobileCacheService } from './mobile-cache.service';
import { MobileMetricsService } from './mobile-metrics.service';
import { PlatformController } from './platform.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditEntry])],
  providers: [AuditService, MobileCacheService, MobileMetricsService],
  controllers: [PlatformController],
  exports: [AuditService, MobileCacheService, MobileMetricsService],
})
export class PlatformModule {}

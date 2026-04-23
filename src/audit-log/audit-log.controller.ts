import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  ParseUUIDPipe,
  Post,
  Body,
} from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { ApiTags, ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { AuditFilterDto } from './dto/audit-filter.dto';

@ApiTags('Admin / Audit')
@ApiBearerAuth()
@Controller(['admin/audit', 'audit-logs'])
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get('user/:userId')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getUserLogs(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.auditLogService.getByUser(
      userId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Get('entity/:entityType/:entityId')
  getEntityLogs(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.auditLogService.getByEntity(entityType, entityId);
  }

  @Get('suspicious')
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  getSuspicious(@Query('from') from: string, @Query('to') to: string) {
    return this.auditLogService.getSuspiciousActivity(
      new Date(from),
      new Date(to),
    );
  }

  @Get('integrity')
  verifyIntegrity() {
    return this.auditLogService.verifyChainIntegrity();
  }

  @Get('timeline/:userId')
  getUserTimeline(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.auditLogService.getUserTimeline(userId);
  }

  // New endpoints for comprehensive audit trail
  @Get()
  @ApiResponse({ status: 200, description: 'Paginated audit history' })
  getAuditTrail(@Query() filter: AuditFilterDto) {
    return this.auditLogService.getAuditTrail(filter);
  }

  @Post('export')
  @ApiResponse({ status: 200, description: 'CSV export of audit logs' })
  exportAuditLog(@Body() dateRange: { from: Date; to: Date }) {
    return this.auditLogService.exportAuditLog(dateRange);
  }
}

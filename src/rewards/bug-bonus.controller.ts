import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BugBonusService } from './bug-bonus.service';
import {
  BugReportSeverity,
  BugReportStatus,
} from './entities/bug-report.entity';

@Controller('api/bug-reports')
export class BugBonusController {
  constructor(private readonly bugBonusService: BugBonusService) {}

  // -----------------------------------------------------------------------
  // User endpoints
  // -----------------------------------------------------------------------

  /**
   * POST /api/bug-reports/submit
   * Submit a new bug report.
   */
  @Post('submit')
  async submit(
    @Body()
    body: {
      reporterId: number;
      title: string;
      description: string;
      severity?: BugReportSeverity;
      stepsToReproduce?: string;
      expectedBehavior?: string;
      actualBehavior?: string;
      affectedVersion?: string;
    },
  ) {
    return this.bugBonusService.submitBugReport(
      body.reporterId,
      body.title,
      body.description,
      body.severity,
      body.stepsToReproduce,
      body.expectedBehavior,
      body.actualBehavior,
      body.affectedVersion,
    );
  }

  /**
   * GET /api/bug-reports/mine/:userId
   * List bug reports submitted by a specific user.
   */
  @Get('mine/:userId')
  async mine(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.bugBonusService.getUserBugReports(userId, +page, +limit);
  }

  // -----------------------------------------------------------------------
  // Admin endpoints
  // -----------------------------------------------------------------------

  /**
   * GET /api/bug-reports
   * List all bug reports with optional filters.
   */
  @Get()
  async list(
    @Query('status') status?: BugReportStatus,
    @Query('severity') severity?: BugReportSeverity,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.bugBonusService.listAllBugReports(status, severity, +page, +limit);
  }

  /**
   * PATCH /api/bug-reports/:id/verify
   * Admin verifies a bug report and sets severity.
   */
  @Patch(':id/verify')
  @HttpCode(HttpStatus.OK)
  async verify(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { adminId: number; severity: BugReportSeverity; notes?: string },
  ) {
    return this.bugBonusService.verifyBugReport(id, body.adminId, body.severity, body.notes);
  }

  /**
   * PATCH /api/bug-reports/:id/reject
   * Admin rejects or marks a bug as duplicate.
   */
  @Patch(':id/reject')
  @HttpCode(HttpStatus.OK)
  async reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { adminId: number; reason: string; duplicateOfId?: string },
  ) {
    return this.bugBonusService.rejectBugReport(id, body.adminId, body.reason, body.duplicateOfId);
  }

  /**
   * POST /api/bug-reports/:id/pay-bonus
   * Admin distributes the token bonus for a verified bug report.
   */
  @Post(':id/pay-bonus')
  @HttpCode(HttpStatus.OK)
  async payBonus(
    @Param('id', ParseIntPipe) id: number,
    @Body('adminId', ParseIntPipe) adminId: number,
  ) {
    return this.bugBonusService.distributeBugBonus(id, adminId);
  }

  /**
   * GET /api/bug-reports/stats
   * Admin: get bug report summary statistics.
   */
  @Get('stats')
  async stats() {
    return this.bugBonusService.getBugReportStats();
  }
}

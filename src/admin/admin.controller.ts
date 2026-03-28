import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseGuards, Request, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { Throttle }           from '@nestjs/throttler';
import { AdminGuard }         from '../common/guards/admin.guard';
import { AdminService }       from './admin.service';
import { WaitlistService }    from '../waitlist/waitlist.service';
import { WaitlistQueryDto }   from '../waitlist/dto/waitlist-query.dto';
import { PatchWaitlistStatusDto } from '../waitlist/dto/patch-waitlist-status.dto';
import { AdjustPointsDto }    from './dto/adjust-points.dto';
import { ReferralQueryDto }   from './dto/referral-query.dto';

@Controller('admin')
@UseGuards(AdminGuard)
@Throttle({ default: { limit: 30, ttl: 60000 } })
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly waitlistService: WaitlistService,
  ) {}

  // #201 GET /admin/waitlist
  @Get('waitlist')
  getWaitlist(@Query() query: WaitlistQueryDto) {
    return this.waitlistService.findAll(query);
  }

  @Get('waitlist/stats')
  getWaitlistStats() {
    return this.waitlistService.getStats();
  }

  // #201 GET /admin/referrals
  @Get('referrals')
  getReferrals(@Query() query: ReferralQueryDto) {
    return this.adminService.getReferrals(query);
  }

  @Get('referrals/stats')
  getReferralStats() {
    return this.adminService.getReferralStats();
  }

  // #201 POST /admin/waitlist/:id/invite
  @Post('waitlist/:id/invite')
  @HttpCode(HttpStatus.OK)
  async invite(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    const result = await this.waitlistService.invite(id, req.user.id);
    await this.adminService.auditEntry(req.user.id, 'invite', 'waitlist', id);
    return result;
  }

  // #201 PATCH /admin/waitlist/:id/status
  @Patch('waitlist/:id/status')
  async patchStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchWaitlistStatusDto,
    @Request() req: any,
  ) {
    const result = await this.waitlistService.patchStatus(id, dto, req.user.id);
    await this.adminService.auditEntry(req.user.id, 'patch_status', 'waitlist', id, dto);
    return result;
  }

  // #201 POST /admin/referrals/:id/adjust
  @Post('referrals/:id/adjust')
  @HttpCode(HttpStatus.OK)
  adjustPoints(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustPointsDto,
    @Request() req: any,
  ) {
    return this.adminService.adjustPoints(id, dto, req.user.id);
  }
}

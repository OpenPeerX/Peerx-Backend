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
import { AffiliateService } from './affiliate.service';
import { AffiliateStatus } from './entities/affiliate.entity';

@Controller('api/affiliates')
export class AffiliateController {
  constructor(private readonly affiliateService: AffiliateService) {}

  // -----------------------------------------------------------------------
  // Affiliate self-service
  // -----------------------------------------------------------------------

  // POST /api/affiliates/register
  @Post('register')
  async register(@Body('userId', ParseIntPipe) userId: number) {
    return this.affiliateService.registerAffiliate(userId);
  }

  // GET /api/affiliates/profile/:userId
  @Get('profile/:userId')
  async profile(@Param('userId', ParseIntPipe) userId: number) {
    return this.affiliateService.getAffiliateProfile(userId);
  }

  // GET /api/affiliates/payouts/:userId
  @Get('payouts/:userId')
  async payouts(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.affiliateService.getPayoutHistory(userId, +page, +limit);
  }

  // -----------------------------------------------------------------------
  // Admin endpoints
  // -----------------------------------------------------------------------

  // GET /api/affiliates
  @Get()
  async list(
    @Query('status') status?: AffiliateStatus,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.affiliateService.listAffiliates(status, +page, +limit);
  }

  // PATCH /api/affiliates/:id/review
  @Patch(':id/review')
  @HttpCode(HttpStatus.OK)
  async review(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { decision: 'approve' | 'reject'; adminId: number; notes?: string },
  ) {
    return this.affiliateService.reviewAffiliate(id, body.decision, body.adminId, body.notes);
  }

  // POST /api/affiliates/payouts/process
  @Post('payouts/process')
  @HttpCode(HttpStatus.OK)
  async processPayouts() {
    return this.affiliateService.processMonthlyPayouts();
  }

  // GET /api/affiliates/report/commissions
  @Get('report/commissions')
  async commissionReport(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.affiliateService.getCommissionReport(from, to, +page, +limit);
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  BugReport,
  BugReportStatus,
  BugReportSeverity,
  SEVERITY_BONUS_MAP,
} from './entities/bug-report.entity';
import { User } from '../user/entities/user.entity';
import { UserBalance } from '../balance/entities/user-balance.entity';
import { BalanceAudit } from '../balance/balance-audit.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationChannel } from '../notification/entities/notification.entity';

@Injectable()
export class BugBonusService {
  private readonly logger = new Logger(BugBonusService.name);

  constructor(
    @InjectRepository(BugReport)
    private readonly bugReportRepo: Repository<BugReport>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserBalance)
    private readonly balanceRepo: Repository<UserBalance>,
    @InjectRepository(BalanceAudit)
    private readonly auditRepo: Repository<BalanceAudit>,
    private readonly dataSource: DataSource,
    private readonly notificationService: NotificationService,
  ) {}

  // ---------------------------------------------------------------------------
  // Submission (user-facing)
  // ---------------------------------------------------------------------------

  /**
   * Submit a bug report. Initial severity is self-assessed; admin verifies.
   */
  async submitBugReport(
    reporterId: number,
    title: string,
    description: string,
    severity: BugReportSeverity = BugReportSeverity.LOW,
    stepsToReproduce?: string,
    expectedBehavior?: string,
    actualBehavior?: string,
    affectedVersion?: string,
  ): Promise<BugReport> {
    const user = await this.userRepo.findOne({ where: { id: reporterId } });
    if (!user) throw new NotFoundException('User not found');

    if (!title?.trim() || !description?.trim()) {
      throw new BadRequestException('Title and description are required');
    }

    const bugReport = this.bugReportRepo.create({
      reporterId,
      title: title.trim(),
      description: description.trim(),
      severity,
      stepsToReproduce,
      expectedBehavior,
      actualBehavior,
      affectedVersion,
      status: BugReportStatus.SUBMITTED,
      bonusAmount: 0, // Set by admin after verification
    });

    const saved = await this.bugReportRepo.save(bugReport);
    this.logger.log(`Bug report #${saved.id} submitted by user ${reporterId}`);

    // Acknowledge submission
    try {
      await this.notificationService.send({
        userId: reporterId,
        type: 'BUG_REPORT_SUBMITTED',
        channels: [NotificationChannel.Email],
        subject: `🐛 Bug report received – #${saved.id}`,
        message: `Hi ${user.username},\n\nThank you for submitting bug report #${saved.id}: "${title}".\n\nOur team will review it and get back to you. If your bug is verified, you'll receive a token bonus based on severity:\n- Low: ${SEVERITY_BONUS_MAP[BugReportSeverity.LOW]} tokens\n- Medium: ${SEVERITY_BONUS_MAP[BugReportSeverity.MEDIUM]} tokens\n- High: ${SEVERITY_BONUS_MAP[BugReportSeverity.HIGH]} tokens\n- Critical: ${SEVERITY_BONUS_MAP[BugReportSeverity.CRITICAL]} tokens\n\nThank you for helping improve SwapTrade!\nThe SwapTrade Team`,
      });
    } catch (err) {
      this.logger.error(`Failed to send submission notification for bug #${saved.id}:`, err);
    }

    return saved;
  }

  /**
   * List bug reports submitted by a user.
   */
  async getUserBugReports(userId: number, page = 1, limit = 20) {
    const [data, total] = await this.bugReportRepo.findAndCount({
      where: { reporterId: userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ---------------------------------------------------------------------------
  // Admin review flow
  // ---------------------------------------------------------------------------

  /**
   * Admin: list all bug reports with optional filters.
   */
  async listAllBugReports(
    status?: BugReportStatus,
    severity?: BugReportSeverity,
    page = 1,
    limit = 20,
  ) {
    const where: any = {};
    if (status) where.status = status;
    if (severity) where.severity = severity;

    const [data, total] = await this.bugReportRepo.findAndCount({
      where,
      relations: ['reporter'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: data.map((r) => ({
        ...r,
        expectedBonus: SEVERITY_BONUS_MAP[r.severity],
        reporterUsername: r.reporter?.username ?? 'Unknown',
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Admin: verify a bug report and set severity + auto-calculated bonus.
   * Moves status to VERIFIED and stores the expected bonus.
   */
  async verifyBugReport(
    bugReportId: number,
    adminId: number,
    verifiedSeverity: BugReportSeverity,
    notes?: string,
  ): Promise<BugReport> {
    const report = await this.bugReportRepo.findOne({
      where: { id: bugReportId },
      relations: ['reporter'],
    });
    if (!report) throw new NotFoundException('Bug report not found');

    if (report.status !== BugReportStatus.SUBMITTED && report.status !== BugReportStatus.UNDER_REVIEW) {
      throw new BadRequestException(`Cannot verify a report with status "${report.status}"`);
    }

    const bonusAmount = SEVERITY_BONUS_MAP[verifiedSeverity];

    report.status = BugReportStatus.VERIFIED;
    report.severity = verifiedSeverity;
    report.bonusAmount = bonusAmount;
    report.reviewerNotes = notes ?? null;
    report.reviewedBy = adminId;
    report.reviewedAt = new Date();

    const saved = await this.bugReportRepo.save(report);

    try {
      await this.notificationService.send({
        userId: report.reporterId,
        type: 'BUG_REPORT_VERIFIED',
        channels: [NotificationChannel.Email],
        subject: `✅ Bug #${report.id} verified – ${bonusAmount} tokens incoming`,
        message: `Hi ${report.reporter?.username ?? 'there'},\n\nYour bug report #${report.id}: "${report.title}" has been verified as ${verifiedSeverity} severity.\n\nBonus: ${bonusAmount} tokens will be credited to your account shortly.\n${notes ? `\nAdmin notes: ${notes}` : ''}\n\nThank you for making SwapTrade better!\nThe SwapTrade Team`,
      });
    } catch (err) {
      this.logger.error(`Failed to send verification notification for bug #${report.id}:`, err);
    }

    this.logger.log(`Bug #${bugReportId} verified (${verifiedSeverity}) by admin ${adminId}, bonus: ${bonusAmount} tokens`);
    return saved;
  }

  /**
   * Admin: reject a bug report (not a bug / out of scope / duplicate).
   */
  async rejectBugReport(
    bugReportId: number,
    adminId: number,
    reason: string,
    duplicateOfId?: string,
  ): Promise<BugReport> {
    const report = await this.bugReportRepo.findOne({
      where: { id: bugReportId },
      relations: ['reporter'],
    });
    if (!report) throw new NotFoundException('Bug report not found');

    report.status = duplicateOfId ? BugReportStatus.DUPLICATE : BugReportStatus.REJECTED;
    report.reviewerNotes = reason;
    report.reviewedBy = adminId;
    report.reviewedAt = new Date();
    if (duplicateOfId) report.duplicateOfId = duplicateOfId;

    const saved = await this.bugReportRepo.save(report);

    try {
      await this.notificationService.send({
        userId: report.reporterId,
        type: 'BUG_REPORT_REJECTED',
        channels: [NotificationChannel.Email],
        subject: `Bug report #${report.id} update`,
        message: `Hi ${report.reporter?.username ?? 'there'},\n\nWe've reviewed your bug report #${report.id}: "${report.title}".\n\nOutcome: ${duplicateOfId ? `Duplicate of #${duplicateOfId}` : 'Rejected'}\nReason: ${reason}\n\nWe appreciate your effort in helping improve SwapTrade!\nThe SwapTrade Team`,
      });
    } catch (err) {
      this.logger.error(`Failed to send rejection notification for bug #${report.id}:`, err);
    }

    return saved;
  }

  /**
   * Admin: distribute the token bonus for a VERIFIED bug report.
   * Credits the reporter's balance and marks the report as BONUS_PAID.
   */
  async distributeBugBonus(bugReportId: number, adminId: number): Promise<{ success: boolean; bonusPaid: number }> {
    const report = await this.bugReportRepo.findOne({
      where: { id: bugReportId, status: BugReportStatus.VERIFIED },
      relations: ['reporter'],
    });
    if (!report) {
      throw new NotFoundException('Verified bug report not found');
    }

    if (Number(report.bonusAmount) <= 0) {
      throw new BadRequestException('Bug report has no bonus amount set');
    }

    const bonusAmount = Number(report.bonusAmount);

    const PLATFORM_TOKEN_ASSET_ID = 1; // Platform token asset ID

    await this.dataSource.transaction(async (manager) => {
      // Credit or create user balance record (assetId=1 = platform token)
      let balance = await manager.findOne(UserBalance, {
        where: { userId: report.reporterId, assetId: PLATFORM_TOKEN_ASSET_ID },
      });
      if (!balance) {
        balance = manager.create(UserBalance, {
          userId: report.reporterId,
          assetId: PLATFORM_TOKEN_ASSET_ID,
          balance: 0,
        });
      }
      balance.balance = Number(balance.balance) + bonusAmount;
      await manager.save(UserBalance, balance);

      // Audit trail
      const audit = manager.create(BalanceAudit, {
        userId: String(report.reporterId),
        asset: 'SWAP_TOKEN',
        amountChanged: bonusAmount,
        resultingBalance: Number(balance.balance),
        reason: `Bug report #${report.id} bonus (${report.severity})`,
      });
      await manager.save(BalanceAudit, audit);

      // Mark report as paid
      await manager.update(BugReport, report.id, {
        status: BugReportStatus.BONUS_PAID,
        bonusPaidAt: new Date(),
      });
    });

    // Notify reporter
    try {
      await this.notificationService.send({
        userId: report.reporterId,
        type: 'BUG_BONUS_PAID',
        channels: [NotificationChannel.Email],
        subject: `🎉 ${bonusAmount} tokens added to your account!`,
        message: `Hi ${report.reporter?.username ?? 'there'},\n\n${bonusAmount} tokens have been credited to your SwapTrade account as a reward for bug report #${report.id}: "${report.title}".\n\nThank you for helping us build a better platform!\nThe SwapTrade Team`,
      });
    } catch (err) {
      this.logger.error(`Failed to send bonus notification for bug #${report.id}:`, err);
    }

    this.logger.log(`Bug bonus paid: report #${bugReportId}, amount=${bonusAmount}, by admin ${adminId}`);
    return { success: true, bonusPaid: bonusAmount };
  }

  /**
   * Stats: bug report summary for admin dashboard.
   */
  async getBugReportStats(): Promise<object> {
    const total = await this.bugReportRepo.count();
    const submitted = await this.bugReportRepo.count({ where: { status: BugReportStatus.SUBMITTED } });
    const verified = await this.bugReportRepo.count({ where: { status: BugReportStatus.VERIFIED } });
    const paid = await this.bugReportRepo.count({ where: { status: BugReportStatus.BONUS_PAID } });
    const rejected = await this.bugReportRepo.count({ where: { status: BugReportStatus.REJECTED } });

    const totalBonusPaid = await this.bugReportRepo
      .createQueryBuilder('r')
      .select('SUM(r.bonusAmount)', 'total')
      .where('r.status = :status', { status: BugReportStatus.BONUS_PAID })
      .getRawOne();

    return {
      total,
      submitted,
      verified,
      paid,
      rejected,
      totalBonusTokensPaid: Number(totalBonusPaid?.total ?? 0),
      severityBonusTable: SEVERITY_BONUS_MAP,
    };
  }
}

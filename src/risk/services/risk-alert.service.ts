import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RiskProfile } from '../entities/risk-profile.entity';
import { PortfolioService } from '../../portfolio/portfolio.service';
import { OptionsService } from '../../options/options.service';
import { NotificationService } from '../../notification/notification.service';
import { NotificationEventType } from '../../common/enums/notification-event-type.enum';
import { RiskService } from './risk.service';

@Injectable()
export class RiskAlertService {
  private readonly logger = new Logger(RiskAlertService.name);

  constructor(
    @InjectRepository(RiskProfile)
    private readonly riskProfileRepository: Repository<RiskProfile>,
    private readonly portfolioService: PortfolioService,
    private readonly optionsService: OptionsService,
    private readonly riskService: RiskService,
    private readonly notificationService: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async monitorPortfolioRisks() {
    this.logger.log('Running background risk and margin checks...');
    const profiles = await this.riskProfileRepository.find();

    for (const profile of profiles) {
      try {
        await this.checkPortfolioDrawdown(profile);
        await this.checkMarginRequirements(profile);
      } catch (error) {
        this.logger.error(`Error monitoring risks for user ${profile.userId}`, error.stack);
      }
    }
  }

  private async checkPortfolioDrawdown(profile: RiskProfile) {
    const summary = await this.portfolioService.getPortfolioSummary(profile.userId.toString());
    if (!summary || summary.totalValue <= 0) return;

    // Simulate retrieving peak value from history or mock it for now
    // If drawing down exceeds maxDrawdownLimit, alert user
    const mockPeakValue = summary.totalValue * 1.05; // Assuming they are at a 5% drop max
    const drawdown = this.riskService.calculateDrawdown(mockPeakValue, summary.totalValue);

    // Save current drawdown stats softly
    profile.maxDrawdown = Math.max(profile.maxDrawdown, drawdown);
    profile.lastCalculatedAt = new Date();
    await this.riskProfileRepository.save(profile);

    if (drawdown > profile.maxDrawdownLimit) {
      this.logger.warn(`User ${profile.userId} exceeded max drawdown: ${(drawdown * 100).toFixed(2)}%`);

      await this.notificationService.sendEvent(
        profile.userId,
        NotificationEventType.PRICE_ALERT,
        `Risk Alert: Your portfolio has experienced a drawdown of ${(drawdown * 100).toFixed(2)}%, exceeding your tolerance of ${(profile.maxDrawdownLimit * 100).toFixed(2)}%.`
      );
    }
    
    // Check diversification
    const divAnalysis = this.riskService.analyzeDiversification(summary.assets, profile.positionLimit);
    if (!divAnalysis.isDiversified && Math.random() < 0.05) { // Only occasionally alert about this
        await this.notificationService.sendEvent(
            profile.userId,
            NotificationEventType.PRICE_ALERT,
            `Risk Alert: Your portfolio is heavily concentrated. ${divAnalysis.recommendations[0]}`
        );
    }
  }

  private async checkMarginRequirements(profile: RiskProfile) {
    // We check options positions to ensure they have enough margin backing them
    const positions = await this.optionsService.getPositions(profile.userId);
    let totalUnrealizedLoss = 0;
    let totalMarginHeld = 0;

    for (const pos of positions) {
      if (pos.unrealizedPnl.unrealized < 0) {
         totalUnrealizedLoss += Math.abs(pos.unrealizedPnl.unrealized);
      }
      totalMarginHeld += Number(pos.marginHeld);
    }

    // A basic margin call logic: If unrealized losses erode > 80% of held margin
    if (totalMarginHeld > 0 && totalUnrealizedLoss > totalMarginHeld * 0.8) {
      this.logger.warn(`Margin Call Alert for user ${profile.userId}`);
      await this.notificationService.sendEvent(
        profile.userId,
        NotificationEventType.PRICE_ALERT, // Using price alert for margin calls
        `MARGIN CALL: Your unrealized losses in options are dangerously close to your held margin. Consider closing positions.`
      );
    }
  }
}

import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  FundHealthMetrics,
  HealthStatus,
} from '../entities/fund-health-metrics.entity';
import { InsuranceFund, FundStatus } from '../entities/insurance-fund.entity';
import { InsuranceClaim, ClaimStatus } from '../entities/insurance-claim.entity';
import { LiquidationEvent, LiquidationStatus } from '../entities/liquidation-event.entity';

@Injectable()
export class FundHealthMonitoringService {
  private readonly logger = new Logger(FundHealthMonitoringService.name);

  // Thresholds for health status transitions
  private readonly HEALTHY_THRESHOLD = 0.75; // 75% = HEALTHY
  private readonly WARNING_THRESHOLD = 0.5; // 50% = WARNING
  private readonly CRITICAL_THRESHOLD = 0.25; // 25% = CRITICAL
  private readonly EMERGENCY_THRESHOLD = 0.1; // 10% = EMERGENCY

  constructor(
    @InjectRepository(FundHealthMetrics)
    private readonly metricsRepository: Repository<FundHealthMetrics>,
    @InjectRepository(InsuranceFund)
    private readonly fundRepository: Repository<InsuranceFund>,
    @InjectRepository(InsuranceClaim)
    private readonly claimRepository: Repository<InsuranceClaim>,
    @InjectRepository(LiquidationEvent)
    private readonly liquidationRepository: Repository<LiquidationEvent>,
  ) {}

  /**
   * Calculate fund health metrics
   */
  async calculateHealthMetrics(fundId: number): Promise<FundHealthMetrics> {
    const fund = await this.fundRepository.findOne({
      where: { id: fundId },
    });

    if (!fund) {
      throw new NotFoundException(`Fund not found: ${fundId}`);
    }

    // Calculate funding level (as percentage of target)
    const fundingLevel = fund.targetBalance > 0
      ? (fund.balance / fund.targetBalance) * 100
      : 100;

    // Calculate burn rate (claims per hour)
    const recentClaims = await this.claimRepository
      .createQueryBuilder('c')
      .where('c.fund.id = :fundId', { fundId })
      .andWhere('c.status = :status', { status: ClaimStatus.PAID })
      .andWhere(
        'c.paidAt >= :since',
        { since: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
      )
      .getMany();

    const totalPaidLast24h = recentClaims.reduce((sum, c) => sum + c.paidAmount, 0);
    const burnRate = totalPaidLast24h / 24; // Per hour

    // Calculate days until depletion
    let daysToDepletion = burn > 0
      ? fund.balance / burnRate / 24
      : 999;

    if (daysToDepletion > 999) daysToDepletion = 999; // Cap at 999 days

    // Count active threats
    const activeLiquidations = await this.liquidationRepository.count({
      where: {
        fund: { id: fundId },
        status: LiquidationStatus.IN_PROGRESS,
      },
    });

    const pendingClaims = await this.claimRepository.count({
      where: {
        fund: { id: fundId },
        status: ClaimStatus.PENDING,
      },
    });

    const activeThreatCount = activeLiquidations + pendingClaims;

    // Calculate volatility index
    const volatilityIndex = await this.calculateVolatilityIndex(fund, activeThreatCount);

    // Determine health status
    const healthStatus = this.determineHealthStatus(fundingLevel);

    // Calculate coverage ratio (balance as % available for coverage)
    const coverageRatio = (fund.balance / (fund.balance + totalPaidLast24h)) * 100;

    // Get or create metrics record
    let metrics = await this.metricsRepository.findOne({
      where: { fund: { id: fundId } },
      relations: ['fund'],
    });

    if (!metrics) {
      metrics = this.metricsRepository.create({
        fund,
      });
    }

    // Update metrics
    metrics.fundingLevel = fundingLevel;
    metrics.burnRate = burnRate;
    metrics.daysToDepletion = daysToDepletion;
    metrics.activeThreatCount = activeThreatCount;
    metrics.volatilityIndex = volatilityIndex;
    metrics.healthStatus = healthStatus;
    metrics.coverageRatio = coverageRatio;
    metrics.lastUpdated = new Date();

    return await this.metricsRepository.save(metrics);
  }

  /**
   * Determine health status based on funding level
   */
  private determineHealthStatus(fundingLevel: number): HealthStatus {
    if (fundingLevel >= this.HEALTHY_THRESHOLD * 100) return HealthStatus.HEALTHY;
    if (fundingLevel >= this.WARNING_THRESHOLD * 100) return HealthStatus.WARNING;
    if (fundingLevel >= this.CRITICAL_THRESHOLD * 100) return HealthStatus.CRITICAL;
    return HealthStatus.EMERGENCY;
  }

  /**
   * Calculate volatility index (0-100)
   */
  private async calculateVolatilityIndex(fund: InsuranceFund, activeThreatCount: number): Promise<number> {
    let index = 0;

    // Factor 1: Funding level (0-40 points)
    const fundingLevel = fund.balance / fund.targetBalance;
    if (fundingLevel < 0.1) index += 40;
    else if (fundingLevel < 0.25) index += 30;
    else if (fundingLevel < 0.5) index += 20;
    else if (fundingLevel < 0.75) index += 10;

    // Factor 2: Active threats (0-40 points)
    if (activeThreatCount > 100) index += 40;
    else if (activeThreatCount > 50) index += 30;
    else if (activeThreatCount > 20) index += 20;
    else if (activeThreatCount > 5) index += 10;

    // Factor 3: recent claim payouts (0-20 points)
    const recentPayouts = await this.claimRepository
      .createQueryBuilder('c')
      .select('SUM(c.paidAmount)', 'total')
      .where('c.fund.id = :fundId', { fundId: fund.id })
      .andWhere('c.status = :status', { status: ClaimStatus.PAID })
      .andWhere('c.paidAt >= :since', { since: new Date(Date.now() - 1 * 60 * 60 * 1000) }) // Last hour
      .getRawOne();

    const recentPayoutAmount = recentPayouts?.total || 0;
    if (recentPayoutAmount > fund.targetBalance * 0.1) index += 20;
    else if (recentPayoutAmount > fund.targetBalance * 0.05) index += 15;
    else if (recentPayoutAmount > 0) index += 10;

    return Math.min(100, index);
  }

  /**
   * Get current health status
   */
  async getHealthStatus(fundId: number): Promise<FundHealthMetrics> {
    let metrics = await this.metricsRepository.findOne({
      where: { fund: { id: fundId } },
      relations: ['fund'],
    });

    if (!metrics) {
      // Calculate if not exists
      return await this.calculateHealthMetrics(fundId);
    }

    // Update if stale (more than 5 minutes old)
    const ageMs = Date.now() - metrics.lastUpdated.getTime();
    if (ageMs > 5 * 60 * 1000) {
      return await this.calculateHealthMetrics(fundId);
    }

    return metrics;
  }

  /**
   * Check if fund needs auto-refill
   */
  async checkAutoRefillNeeded(fundId: number): Promise<{
    needsRefill: boolean;
    currentBalance: number;
    targetBalance: number;
    refillAmount: number;
  }> {
    const fund = await this.fundRepository.findOne({
      where: { id: fundId },
    });

    if (!fund) {
      throw new NotFoundException(`Fund not found: ${fundId}`);
    }

    const needsRefill =
      fund.autoRefillEnabled &&
      fund.balance < fund.targetBalance &&
      fund.status === FundStatus.ACTIVE;

    return {
      needsRefill,
      currentBalance: fund.balance,
      targetBalance: fund.targetBalance,
      refillAmount: needsRefill ? fund.targetBalance - fund.balance : 0,
    };
  }

  /**
   * Trigger auto-refill if needed
   */
  async triggerAutoRefill(fundId: number): Promise<{
    triggered: boolean;
    refillAmount: number;
    newBalance: number;
  }> {
    const fund = await this.fundRepository.findOne({
      where: { id: fundId },
    });

    if (!fund) {
      throw new NotFoundException(`Fund not found: ${fundId}`);
    }

    const refillCheck = await this.checkAutoRefillNeeded(fundId);

    if (!refillCheck.needsRefill) {
      return {
        triggered: false,
        refillAmount: 0,
        newBalance: fund.balance,
      };
    }

    const refillAmount = fund.targetBalance - fund.balance;

    fund.balance = fund.targetBalance;
    fund.lastAutoRefillAt = new Date();

    await this.fundRepository.save(fund);

    this.logger.log(
      `Auto-refill triggered for fund ${fundId}: added ${refillAmount.toFixed(8)}`,
    );

    return {
      triggered: true,
      refillAmount,
      newBalance: fund.balance,
    };
  }

  /**
   * Generate health alert if needed
   */
  async generateHealthAlert(fundId: number): Promise<{
    alertGenerated: boolean;
    alertLevel: string;
    message: string;
    recommendation?: string;
  }> {
    const metrics = await this.getHealthStatus(fundId);

    let alert = {
      alertGenerated: false,
      alertLevel: 'NONE' as string,
      message: '',
      recommendation: undefined as string | undefined,
    };

    if (metrics.healthStatus === HealthStatus.EMERGENCY) {
      alert.alertGenerated = true;
      alert.alertLevel = 'CRITICAL';
      alert.message = `Fund ${fundId} in EMERGENCY state! Funding level: ${metrics.fundingLevel.toFixed(2)}%`;
      alert.recommendation = 'Immediate action required - consider pausing liquidations';
    } else if (metrics.healthStatus === HealthStatus.CRITICAL) {
      alert.alertGenerated = true;
      alert.alertLevel = 'HIGH';
      alert.message = `Fund ${fundId} CRITICAL. Funding: ${metrics.fundingLevel.toFixed(2)}%, Days to depletion: ${metrics.daysToDepletion.toFixed(2)}`;
      alert.recommendation = 'Increase deposits or reduce coverage ratio';
    } else if (metrics.healthStatus === HealthStatus.WARNING) {
      alert.alertGenerated = true;
      alert.alertLevel = 'MEDIUM';
      alert.message = `Fund ${fundId} WARNING. Funding: ${metrics.fundingLevel.toFixed(2)}%`;
      alert.recommendation = 'Monitor closely - consider increasing contribution rate';
    }

    return alert;
  }

  /**
   * Get comprehensive health report
   */
  async getHealthReport(fundId: number): Promise<any> {
    const fund = await this.fundRepository.findOne({
      where: { id: fundId },
    });

    if (!fund) {
      throw new NotFoundException(`Fund not found: ${fundId}`);
    }

    const metrics = await this.getHealthStatus(fundId);
    const alert = await this.generateHealthAlert(fundId);
    const autoRefillCheck = await this.checkAutoRefillNeeded(fundId);

    // Get recent activity
    const recentClaims = await this.claimRepository
      .createQueryBuilder('c')
      .where('c.fund.id = :fundId', { fundId })
      .andWhere('c.status = :status', { status: ClaimStatus.PAID })
      .andWhere('c.paidAt >= :since', { since: new Date(Date.now() - 24 * 60 * 60 * 1000) })
      .orderBy('c.paidAt', 'DESC')
      .limit(5)
      .getMany();

    const totalClaimed24h = recentClaims.reduce((sum, c) => sum + c.paidAmount, 0);

    return {
      fund: {
        id: fund.id,
        type: fund.fundType,
        status: fund.status,
        balance: fund.balance,
        targetBalance: fund.targetBalance,
        minimumBalance: fund.minimumBalance,
      },
      metrics: {
        fundingLevel: `${metrics.fundingLevel.toFixed(2)}%`,
        burnRate: `${metrics.burnRate.toFixed(8)}/hour`,
        daysToDepletion: `${metrics.daysToDepletion.toFixed(2)} days`,
        activeThreatCount: metrics.activeThreatCount,
        volatilityIndex: metrics.volatilityIndex,
        healthStatus: metrics.healthStatus,
        coverageRatio: `${metrics.coverageRatio.toFixed(2)}%`,
      },
      alert,
      autoRefill: {
        enabled: fund.autoRefillEnabled,
        needsRefill: autoRefillCheck.needsRefill,
        refillAmount: autoRefillCheck.refillAmount,
      },
      recent: {
        claimsLast24h: recentClaims.length,
        totalClaimedLast24h: totalClaimed24h,
      },
    };
  }

  /**
   * Detect anomalies in fund behavior
   */
  async detectAnomalies(fundId: number): Promise<{ detected: boolean; anomalies: string[] }> {
    const fund = await this.fundRepository.findOne({
      where: { id: fundId },
    });

    if (!fund) {
      throw new NotFoundException(`Fund not found: ${fundId}`);
    }

    const anomalies: string[] = [];

    // Check for rapid balance depletion
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentClaims = await this.claimRepository
      .createQueryBuilder('c')
      .where('c.fund.id = :fundId', { fundId })
      .andWhere('c.status = :status', { status: ClaimStatus.PAID })
      .andWhere('c.paidAt >= :since', { since: oneDayAgo })
      .getMany();

    const totalPaid24h = recentClaims.reduce((sum, c) => sum + c.paidAmount, 0);

    if (totalPaid24h > fund.balance * 0.5) {
      anomalies.push(`Rapid depletion detected: ${(totalPaid24h / fund.balance * 100).toFixed(1)}% paid in 24h`);
    }

    // Check for unusual spike in claims
    if (recentClaims.length > 50) {
      anomalies.push(`Claims spike: ${recentClaims.length} claims in 24 hours`);
    }

    // Check for repeated large claims from same user
    const userClaimMap = new Map<number, number>();
    for (const claim of recentClaims) {
      if (claim.claimantUserId) {
        userClaimMap.set(
          claim.claimantUserId,
          (userClaimMap.get(claim.claimantUserId) || 0) + claim.paidAmount,
        );
      }
    }

    for (const [userId, amount] of userClaimMap.entries()) {
      if (amount > fund.balance * 0.2) {
        anomalies.push(`Concentrated claims: User ${userId} claimed ${(amount / fund.balance * 100).toFixed(1)}%`);
      }
    }

    return {
      detected: anomalies.length > 0,
      anomalies,
    };
  }

  /**
   * Get all health metrics
   */
  async getAllHealthMetrics(): Promise<FundHealthMetrics[]> {
    return await this.metricsRepository.find({
      relations: ['fund'],
      order: { lastUpdated: 'DESC' },
    });
  }

  /**
   * Get funds requiring immediate attention
   */
  async getFundsRequiringAttention(): Promise<FundHealthMetrics[]> {
    return await this.metricsRepository.find({
      where: [
        { healthStatus: HealthStatus.CRITICAL },
        { healthStatus: HealthStatus.EMERGENCY },
      ],
      relations: ['fund'],
      order: { lastUpdated: 'DESC' },
    });
  }
}

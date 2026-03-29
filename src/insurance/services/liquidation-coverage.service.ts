import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  LiquidationEvent,
  LiquidationStatus,
} from '../entities/liquidation-event.entity';
import { InsuranceFund, FundStatus } from '../entities/insurance-fund.entity';
import { InsuranceClaim, ClaimStatus, ClaimReason } from '../entities/insurance-claim.entity';
import { InsuranceClaimService } from './insurance-claim.service';
import { FundHealthMonitoringService } from './fund-health-monitoring.service';

@Injectable()
export class LiquidationCoverageService {
  private readonly logger = new Logger(LiquidationCoverageService.name);

  // Cascade prevention thresholds
  private readonly CRITICAL_CASCADE_THRESHOLD = 0.3; // 30% - emergency mode
  private readonly WARNING_CASCADE_THRESHOLD = 0.5; // 50% - warning mode
  private readonly MAX_SIMULTANEOUS_LIQUIDATIONS = 100; // Prevent liquidation storm

  constructor(
    @InjectRepository(LiquidationEvent)
    private readonly liquidationRepository: Repository<LiquidationEvent>,
    @InjectRepository(InsuranceFund)
    private readonly fundRepository: Repository<InsuranceFund>,
    @InjectRepository(InsuranceClaim)
    private readonly claimRepository: Repository<InsuranceClaim>,
    private readonly claimService: InsuranceClaimService,
    private readonly healthMonitoringService: FundHealthMonitoringService,
  ) {}

  /**
   * Record a liquidation event and determine insurance coverage
   */
  async recordLiquidationEvent(
    fundId: number,
    userId: number,
    totalLoss: number,
    reason: string,
    liquidationMetadata?: any,
  ): Promise<{
    liquidationEvent: LiquidationEvent;
    coverageDecision: {
      canCover: boolean;
      coverageAmount: number;
      uncoveredAmount: number;
      failSafeTriggered: boolean;
      cascadeRiskLevel: string;
    };
  }> {
    const fund = await this.fundRepository.findOne({
      where: { id: fundId },
    });

    if (!fund) {
      throw new NotFoundException(`Fund not found: ${fundId}`);
    }

    if (totalLoss <= 0) {
      throw new BadRequestException('Loss amount must be positive');
    }

    // Check cascade prevention thresholds
    const cascadeRisk = await this.assessCascadeRisk(fund);

    // Create liquidation event
    const liquidationEvent = this.liquidationRepository.create({
      fund,
      userId,
      totalLoss,
      description: reason,
      metadata: liquidationMetadata || {},
      status: LiquidationStatus.INITIATED,
      cascadeRiskLevel: cascadeRisk.level,
      volatilityIndex: cascadeRisk.volatilityIndex,
      recordedAt: new Date(),
    });

    // Determine coverage
    const coverageDecision = await this.determineCoverage(
      fund,
      totalLoss,
      liquidationEvent,
      cascadeRisk,
    );

    liquidationEvent.coverageAmount = coverageDecision.coverageAmount;
    liquidationEvent.uncoveredAmount = coverageDecision.uncoveredAmount;
    liquidationEvent.isCovered = coverageDecision.canCover;
    liquidationEvent.failSafeTriggered = coverageDecision.failSafeTriggered;

    await this.liquidationRepository.save(liquidationEvent);

    // If fully covered, create insurance claim automatically
    if (coverageDecision.canCover && coverageDecision.coverageAmount > 0) {
      try {
        await this.claimService.submitClaim(fundId, {
          fundId,
          claimantUserId: userId,
          originalLoss: totalLoss,
          claimReason: ClaimReason.LIQUIDATION_LOSS,
          description: `Auto-claim from liquidation: ${reason}`,
          linkedLiquidationId: liquidationEvent.id,
        });
      } catch (error) {
        this.logger.warn(`Failed to auto-create claim for liquidation ${liquidationEvent.id}: ${error.message}`);
      }
    }

    return {
      liquidationEvent,
      coverageDecision,
    };
  }

  /**
   * Assess cascade liquidation risk
   */
  private async assessCascadeRisk(
    fund: InsuranceFund,
  ): Promise<{
    level: string;
    volatilityIndex: number;
    activeLiquidations: number;
    fundingLevel: number;
  }> {
    const fundingLevel = fund.balance / fund.targetBalance;
    const activeLiquidations = await this.liquidationRepository.count({
      where: {
        fund: { id: fund.id },
        status: LiquidationStatus.IN_PROGRESS,
      },
    });

    // Calculate volatility index (0-100)
    let volatilityIndex = 0;
    if (activeLiquidations > 50) volatilityIndex += 40;
    else if (activeLiquidations > 20) volatilityIndex += 30;
    else if (activeLiquidations > 10) volatilityIndex += 20;

    if (fundingLevel < 0.1) volatilityIndex += 30;
    else if (fundingLevel < 0.25) volatilityIndex += 20;
    else if (fundingLevel < 0.5) volatilityIndex += 10;

    // Determine risk level
    let riskLevel = 'LOW';
    if (volatilityIndex > 70) {
      riskLevel = 'CRITICAL';
    } else if (volatilityIndex > 50) {
      riskLevel = 'HIGH';
    } else if (volatilityIndex > 30) {
      riskLevel = 'MEDIUM';
    }

    return {
      level: riskLevel,
      volatilityIndex,
      activeLiquidations,
      fundingLevel,
    };
  }

  /**
   * Determine coverage decision with fail-safe mechanisms
   */
  private async determineCoverage(
    fund: InsuranceFund,
    totalLoss: number,
    liquidationEvent: LiquidationEvent,
    cascadeRisk: any,
  ): Promise<{
    canCover: boolean;
    coverageAmount: number;
    uncoveredAmount: number;
    failSafeTriggered: boolean;
    reason?: string;
  }> {
    // FAIL-SAFE 1: Check fund status
    if (fund.status !== FundStatus.ACTIVE) {
      return {
        canCover: false,
        coverageAmount: 0,
        uncoveredAmount: totalLoss,
        failSafeTriggered: true,
        reason: `Fund status is ${fund.status}`,
      };
    }

    // FAIL-SAFE 2: Check for liquidation storm (cascade trigger)
    if (cascadeRisk.activeLiquidations >= this.MAX_SIMULTANEOUS_LIQUIDATIONS) {
      this.logger.warn(
        `CASCADE WARNING: ${cascadeRisk.activeLiquidations} simultaneous liquidations detected. Pausing coverage.`,
      );
      return {
        canCover: false,
        coverageAmount: 0,
        uncoveredAmount: totalLoss,
        failSafeTriggered: true,
        reason: 'Liquidation storm detected - cascade prevention activated',
      };
    }

    // FAIL-SAFE 3: Critical cascade threshold
    if (
      cascadeRisk.volatilityIndex >= 70 &&
      fund.balance < fund.minimumBalance
    ) {
      this.logger.warn(
        `CASCADE CRITICAL: Fund in critical state with volatility index ${cascadeRisk.volatilityIndex}`,
      );
      return {
        canCover: false,
        coverageAmount: 0,
        uncoveredAmount: totalLoss,
        failSafeTriggered: true,
        reason: 'Fund in critical state - cascade protection engaged',
      };
    }

    // FAIL-SAFE 4: Reserve minimum balance
    const reservedBalance = fund.minimumBalance;
    const availableForCoverage = Math.max(0, fund.balance - reservedBalance);

    // Calculate standard coverage
    const maxCoverage = (totalLoss * fund.coverageRatio) / 100;
    let coverageAmount = Math.min(maxCoverage, availableForCoverage);

    // FAIL-SAFE 5: Graduated coverage under stress
    if (cascadeRisk.level === 'CRITICAL') {
      // In critical state, reduce coverage to 50%
      coverageAmount = coverageAmount * 0.5;
      this.logger.warn(
        `Critical cascade state: reducing coverage to 50% (${coverageAmount.toFixed(8)})`,
      );
    } else if (cascadeRisk.level === 'HIGH') {
      // In high risk state, reduce coverage to 75%
      coverageAmount = coverageAmount * 0.75;
      this.logger.warn(
        `High cascade state: reducing coverage to 75% (${coverageAmount.toFixed(8)})`,
      );
    }

    const uncoveredAmount = totalLoss - coverageAmount;
    const canCover = coverageAmount > 0;

    liquidationEvent.status = LiquidationStatus.IN_PROGRESS;

    return {
      canCover,
      coverageAmount,
      uncoveredAmount,
      failSafeTriggered: false,
    };
  }

  /**
   * Finalize liquidation with coverage applied
   */
  async finalizeLiquidation(
    liquidationId: number,
    claimId?: number,
  ): Promise<LiquidationEvent> {
    const liquidation = await this.liquidationRepository.findOne({
      where: { id: liquidationId },
      relations: ['fund'],
    });

    if (!liquidation) {
      throw new NotFoundException(`Liquidation not found: ${liquidationId}`);
    }

    if (liquidation.status === LiquidationStatus.COMPLETED) {
      return liquidation;
    }

    // Mark as completed
    if (liquidation.isCovered && liquidation.coverageAmount > 0) {
      liquidation.status = LiquidationStatus.FULLY_COVERED;
      liquidation.fund.liquidationsCovered++;
    } else if (liquidation.uncoveredAmount > 0 && liquidation.coverageAmount > 0) {
      liquidation.status = LiquidationStatus.PARTIALLY_COVERED;
    } else {
      liquidation.status = LiquidationStatus.FAILED;
    }

    liquidation.completedAt = new Date();

    await this.fundRepository.save(liquidation.fund);
    return await this.liquidationRepository.save(liquidation);
  }

  /**
   * Check if cascade liquidation is imminent
   */
  async isCascadeLiquidationImminent(fundId: number): Promise<boolean> {
    const fund = await this.fundRepository.findOne({
      where: { id: fundId },
    });

    if (!fund) return false;

    // Check multiple indicators
    const cascadeRisk = await this.assessCascadeRisk(fund);

    // Cascade is imminent if:
    // 1. Volatility index is critical
    // 2. Fund balance is below 10% of target
    // 3. Too many active liquidations already

    return (
      cascadeRisk.volatilityIndex > 70 &&
      cascadeRisk.fundingLevel < 0.1 &&
      cascadeRisk.activeLiquidations > 50
    );
  }

  /**
   * Prevent cascade liquidation by pausing and alerting
   */
  async preventCascadeLiquidation(fundId: number): Promise<{
    preventionActivated: boolean;
    currentStatus: FundStatus;
    failSafeLevel: string;
  }> {
    let fund = await this.fundRepository.findOne({
      where: { id: fundId },
    });

    if (!fund) {
      throw new NotFoundException(`Fund not found: ${fundId}`);
    }

    const isCascadeImminent = await this.isCascadeLiquidationImminent(fundId);

    if (isCascadeImminent) {
      const originalStatus = fund.status;
      fund.status = FundStatus.PAUSED;

      this.logger.error(
        `CASCADE PREVENTION: Fund ${fundId} paused to prevent liquidation cascade. Original status: ${originalStatus}`,
      );

      await this.fundRepository.save(fund);

      return {
        preventionActivated: true,
        currentStatus: FundStatus.PAUSED,
        failSafeLevel: 'CRITICAL - FUND PAUSED',
      };
    }

    return {
      preventionActivated: false,
      currentStatus: fund.status,
      failSafeLevel: 'NORMAL',
    };
  }

  /**
   * Get liquidation history for analysis
   */
  async getLiquidationHistory(
    fundId: number,
    status?: LiquidationStatus,
    limit: number = 100,
  ): Promise<LiquidationEvent[]> {
    const query = this.liquidationRepository.createQueryBuilder('l').where('l.fund.id = :fundId', {
      fundId,
    });

    if (status) {
      query.andWhere('l.status = :status', { status });
    }

    return await query
      .orderBy('l.recordedAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  /**
   * Analyze liquidation patterns for risk
   */
  async analyzeLiquidationPatterns(fundId: number): Promise<{
    totalLiquidations: number;
    fullyCovered: number;
    partiallyCovered: number;
    uncovered: number;
    averageLoss: number;
    averageCoveragePercentage: number;
    cascadeEventsDetected: number;
    riskLevel: string;
  }> {
    const liquidations = await this.liquidationRepository.find({
      where: { fund: { id: fundId } },
    });

    let stats = {
      totalLiquidations: liquidations.length,
      fullyCovered: 0,
      partiallyCovered: 0,
      uncovered: 0,
      averageLoss: 0,
      averageCoveragePercentage: 0,
      cascadeEventsDetected: 0,
      riskLevel: 'LOW' as string,
    };

    let totalLoss = 0;
    let totalCoverage = 0;

    for (const liq of liquidations) {
      if (liq.status === LiquidationStatus.FULLY_COVERED) stats.fullyCovered++;
      else if (liq.status === LiquidationStatus.PARTIALLY_COVERED) stats.partiallyCovered++;
      else if (liq.status === LiquidationStatus.FAILED) stats.uncovered++;

      if (liq.volatilityIndex > 50) stats.cascadeEventsDetected++;

      totalLoss += liq.totalLoss;
      totalCoverage += liq.coverageAmount;
    }

    if (stats.totalLiquidations > 0) {
      stats.averageLoss = totalLoss / stats.totalLiquidations;
      stats.averageCoveragePercentage = (totalCoverage / totalLoss) * 100;

      if (stats.cascadeEventsDetected > stats.totalLiquidations * 0.5) {
        stats.riskLevel = 'CRITICAL';
      } else if (stats.uncovered > stats.totalLiquidations * 0.3) {
        stats.riskLevel = 'HIGH';
      } else if (stats.partiallyCovered > stats.totalLiquidations * 0.2) {
        stats.riskLevel = 'MEDIUM';
      }
    }

    return stats;
  }

  /**
   * Get cascade risk metrics
   */
  async getCascadeRiskMetrics(fundId: number): Promise<any> {
    const fund = await this.fundRepository.findOne({
      where: { id: fundId },
    });

    if (!fund) {
      throw new NotFoundException(`Fund not found: ${fundId}`);
    }

    const cascadeRisk = await this.assessCascadeRisk(fund);
    const isImminent = await this.isCascadeLiquidationImminent(fundId);

    return {
      ...cascadeRisk,
      cascadeImminent: isImminent,
      thresholds: {
        warningThreshold: this.WARNING_CASCADE_THRESHOLD * 100,
        criticalThreshold: this.CRITICAL_CASCADE_THRESHOLD * 100,
        maxSimultaneousLiquidations: this.MAX_SIMULTANEOUS_LIQUIDATIONS,
      },
    };
  }

  /**
   * Get fail-safe status
   */
  async getFailSafeStatus(fundId: number): Promise<{
    allFailSafesActive: boolean;
    fundStatus: FundStatus;
    minimumBalanceProtected: boolean;
    cascadeProtectionActive: boolean;
    liquidationStormDetected: boolean;
    emergencyModeTriggered: boolean;
  }> {
    const fund = await this.fundRepository.findOne({
      where: { id: fundId },
    });

    if (!fund) {
      throw new NotFoundException(`Fund not found: ${fundId}`);
    }

    const cascadeRisk = await this.assessCascadeRisk(fund);

    return {
      allFailSafesActive: fund.status === FundStatus.ACTIVE,
      fundStatus: fund.status,
      minimumBalanceProtected: fund.balance >= fund.minimumBalance,
      cascadeProtectionActive: cascadeRisk.level !== 'LOW',
      liquidationStormDetected: cascadeRisk.activeLiquidations > 50,
      emergencyModeTriggered:
        cascadeRisk.volatilityIndex > 70 &&
        fund.balance < fund.minimumBalance,
    };
  }
}

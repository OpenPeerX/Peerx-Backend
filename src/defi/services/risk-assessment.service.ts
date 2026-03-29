/**
 * Risk Assessment Service
 * Analyzes and assesses risk for DeFi positions and portfolios
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeFiPositionEntity, DeFiRiskAssessmentEntity } from '../entities/defi.entity';
import {
  RiskMetrics,
  DeFiPosition,
} from '../interfaces/protocol.interface';
import {
  PortfolioRiskAssessment,
  LiquidationRisk,
  RiskFactor,
} from '../interfaces/defi.interface';

@Injectable()
export class RiskAssessmentService {
  private readonly logger = new Logger(RiskAssessmentService.name);

  constructor(
    @InjectRepository(DeFiPositionEntity)
    private positionRepository: Repository<DeFiPositionEntity>,
    @InjectRepository(DeFiRiskAssessmentEntity)
    private riskRepository: Repository<DeFiRiskAssessmentEntity>,
  ) {}

  /**
   * Assess overall portfolio risk
   */
  async assessPortfolioRisk(userId: string): Promise<PortfolioRiskAssessment> {
    try {
      const positions = await this.positionRepository.find({
        where: { userId, status: 'active' },
      });

      if (positions.length === 0) {
        return {
          overallRisk: 'low',
          riskScore: 0,
          riskFactors: [],
          recommendations: ['Build your DeFi portfolio with low-risk positions'],
          liquidationRisks: [],
        };
      }

      // Calculate aggregate metrics
      let totalValue = 0;
      let totalRiskScore = 0;
      let riskFactors: RiskFactor[] = [];
      const liquidationRisks: LiquidationRisk[] = [];

      for (const position of positions) {
        const amount = parseFloat(position.amountIn);
        totalValue += amount;

        // Calculate position risk score
        const positionRiskScore = this.calculatePositionRiskScore(position);
        totalRiskScore += positionRiskScore * (amount / totalValue);

        // Check for liquidation risk
        if (
          position.healthFactor &&
          position.healthFactor < 2.0
        ) {
          liquidationRisks.push({
            positionId: position.id,
            protocol: position.protocol,
            riskLevel:
              position.healthFactor < 1.2
                ? 'critical'
                : position.healthFactor < 1.5
                  ? 'high'
                  : 'medium',
            liquidationPrice: position.metadata?.liquidationPrice,
            currPrice: 1800,
            distance: 25,
            timeEstimate: 3600,
          });
        }

        // Collect risk factors
        const factors = this.identifyRiskFactors(position);
        riskFactors = [...riskFactors, ...factors];
      }

      // Consolidate risk factors
      riskFactors = this.consolidateRiskFactors(riskFactors);

      // Calculate overall risk level
      const overallRisk = this.determineRiskLevel(totalRiskScore);
      const recommendations = this.generateRecommendations(
        totalRiskScore,
        riskFactors,
        positions.length,
      );

      // Save assessment
      await this.riskRepository.save({
        userId,
        riskScore: totalRiskScore,
        riskLevel: overallRisk,
        factors: riskFactors,
        recommendations,
      });

      return {
        overallRisk,
        riskScore: totalRiskScore,
        riskFactors,
        recommendations,
        liquidationRisks,
      };
    } catch (error) {
      this.logger.error(`Portfolio risk assessment failed: ${error}`);
      throw error;
    }
  }

  /**
   * Calculate risk metrics for a single position
   */
  async getRiskMetrics(position: DeFiPosition): Promise<RiskMetrics> {
    try {
      const positionRiskScore = this.calculatePositionRiskScore(
        position as DeFiPositionEntity,
      );
      const volatilityScore = this.calculateVolatilityScore(position);
      const correlationScore = this.calculateCorrelationScore(position);
      const concentrationRisk = this.calculateConcentrationRisk(position);

      return {
        positionId: position.id,
        riskScore: positionRiskScore,
        riskLevel:
          positionRiskScore < 20
            ? 'low'
            : positionRiskScore < 50
              ? 'medium'
              : 'high',
        liquidationPrice: position.metadata?.liquidationPrice,
        liquidationDistance: position.healthFactor
          ? (position.healthFactor - 1) * 50
          : 0,
        volatilityScore,
        correlationScore,
        concentrationRisk,
      };
    } catch (error) {
      this.logger.error(`Risk metrics calculation failed: ${error}`);
      throw error;
    }
  }

  /**
   * Calculate risk score for individual position
   */
  private calculatePositionRiskScore(position: DeFiPositionEntity): number {
    let score = 0;

    // Leverage risk (0-30 points)
    const leverage = position.borrowed
      ? parseFloat(position.borrowed) /
        (parseFloat(position.amountIn) - parseFloat(position.borrowed))
      : 0;

    if (leverage > 5) score += 30;
    else if (leverage > 3) score += 20;
    else if (leverage > 1) score += 10;

    // Health factor risk (0-30 points)
    if (position.healthFactor) {
      if (position.healthFactor < 1.2) score += 30;
      else if (position.healthFactor < 1.5) score += 20;
      else if (position.healthFactor < 2.0) score += 10;
    }

    // Concentration risk (0-20 points)
    if (position.action === 'farm') score += 15;
    if (position.action === 'borrow') score += 10;

    // Protocol risk (0-20 points)
    const protocolRiskMap: Record<string, number> = {
      Aave: 5,
      Compound: 8,
      Yearn: 12,
      Curve: 10,
      Convex: 15,
    };
    score += protocolRiskMap[position.protocol] || 10;

    return Math.min(score, 100);
  }

  /**
   * Identify risk factors
   */
  private identifyRiskFactors(position: DeFiPositionEntity): RiskFactor[] {
    const factors: RiskFactor[] = [];

    // Liquidation risk
    if (position.healthFactor && position.healthFactor < 1.5) {
      factors.push({
        name: 'Liquidation Risk',
        severity: position.healthFactor < 1.2 ? 90 : 60,
        impact:
          'Position may be liquidated if price moves adversely',
        mitigation: 'Reduce leverage or add more collateral',
      });
    }

    // Concentration risk
    if (position.action === 'farm') {
      factors.push({
        name: 'Concentration Risk',
        severity: 40,
        impact: 'Heavy concentration in single yield farm',
        mitigation: 'Diversify across multiple protocols',
      });
    }

    // Smart contract risk
    factors.push({
      name: 'Smart Contract Risk',
      severity: 30,
      impact: 'Potential vulnerabilities in protocol code',
      mitigation: 'Use audited protocols with good track record',
    });

    // Impermanent loss risk (for LP positions)
    if (position.action === 'farm') {
      factors.push({
        name: 'Impermanent Loss Risk',
        severity: 35,
        impact: 'Potential loss from price divergence in liquidity pool',
        mitigation: 'Use stable pair farming or monitor price movements',
      });
    }

    return factors;
  }

  /**
   * Consolidate and deduplicate risk factors
   */
  private consolidateRiskFactors(factors: RiskFactor[]): RiskFactor[] {
    const factorMap = new Map<string, RiskFactor>();

    for (const factor of factors) {
      if (factorMap.has(factor.name)) {
        const existing = factorMap.get(factor.name)!;
        existing.severity = Math.max(existing.severity, factor.severity);
      } else {
        factorMap.set(factor.name, factor);
      }
    }

    return Array.from(factorMap.values()).sort(
      (a, b) => b.severity - a.severity,
    );
  }

  /**
   * Determine overall risk level
   */
  private determineRiskLevel(
    score: number,
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (score < 20) return 'low';
    if (score < 50) return 'medium';
    if (score < 75) return 'high';
    return 'critical';
  }

  /**
   * Generate risk recommendations
   */
  private generateRecommendations(
    riskScore: number,
    riskFactors: RiskFactor[],
    positionCount: number,
  ): string[] {
    const recommendations: string[] = [];

    if (riskScore > 75) {
      recommendations.push(
        'Your portfolio has critical risk. Consider reducing leverage or exiting high-risk positions.',
      );
    } else if (riskScore > 50) {
      recommendations.push(
        'Consider rebalancing to reduce overall portfolio risk.',
      );
    }

    if (positionCount < 3) {
      recommendations.push(
        'Diversify across multiple protocols to reduce concentration risk.',
      );
    }

    for (const factor of riskFactors) {
      if (factor.severity > 70) {
        recommendations.push(`${factor.name}: ${factor.mitigation}`);
      }
    }

    return recommendations;
  }

  /**
   * Calculate volatility score
   */
  private calculateVolatilityScore(position: DeFiPosition): number {
    // Mock implementation - in production would use historical price data
    return Math.random() * 100;
  }

  /**
   * Calculate correlation score
   */
  private calculateCorrelationScore(position: DeFiPosition): number {
    // Mock implementation - in production would analyze correlation with other positions
    return Math.random() * 100;
  }

  /**
   * Calculate concentration risk
   */
  private calculateConcentrationRisk(position: DeFiPosition): number {
    // Mock implementation - in production would calculate % of portfolio
    const amount = parseFloat(position.amountIn);
    if (amount > 100000) return 75;
    if (amount > 50000) return 50;
    if (amount > 10000) return 30;
    return 10;
  }
}

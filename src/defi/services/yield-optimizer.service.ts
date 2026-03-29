/**
 * Yield Optimizer Service
 * Recommends and manages yield optimization strategies
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeFiStrategyEntity, DeFiPositionEntity } from '../entities/defi.entity';
import {
  YieldStrategy,
  StrategyRecommendation,
  StrategyFilter,
  StrategyComposition,
} from '../interfaces/defi.interface';

@Injectable()
export class YieldOptimizerService {
  private readonly logger = new Logger(YieldOptimizerService.name);

  private readonly predefinedStrategies: YieldStrategy[] = [
    {
      id: 'stable-lending-1',
      name: 'Conservative Stablecoin Lending',
      description: 'Low-risk lending on stablecoins through Aave',
      protocol: 'Aave',
      expectedAPY: 5.2,
      riskLevel: 'low',
      minInvestment: '100',
      maxInvestment: '1000000',
      lockupPeriod: 0,
      complexity: 'beginner',
      composition: [
        {
          protocol: 'Aave',
          operation: 'deposit-usdc',
          allocation: 100,
        },
      ],
    },
    {
      id: 'eth-lending-2',
      name: 'ETH Lending Strategy',
      description: 'Earn yield on ETH deposits through Compound',
      protocol: 'Compound',
      expectedAPY: 4.8,
      riskLevel: 'low',
      minInvestment: '0.1',
      maxInvestment: '1000',
      lockupPeriod: 0,
      complexity: 'beginner',
      composition: [
        {
          protocol: 'Compound',
          operation: 'deposit-eth',
          allocation: 100,
        },
      ],
    },
    {
      id: 'curve-stable-farming-3',
      name: 'Curve Stablecoin Farming',
      description:
        'Provide liquidity to Curve stable swap pools with Convex farming',
      protocol: 'Curve',
      expectedAPY: 12.5,
      riskLevel: 'medium',
      minInvestment: '1000',
      maxInvestment: '10000000',
      lockupPeriod: 0,
      complexity: 'intermediate',
      composition: [
        {
          protocol: 'Curve',
          operation: 'add-liquidity-3pool',
          allocation: 70,
        },
        {
          protocol: 'Convex',
          operation: 'stake-lp',
          allocation: 30,
        },
      ],
    },
    {
      id: 'liquid-staking-4',
      name: 'Liquid Staking Strategy',
      description: 'Stake ETH through Lido to earn staking rewards',
      protocol: 'Lido',
      expectedAPY: 3.5,
      riskLevel: 'low',
      minInvestment: '0.01',
      maxInvestment: '10000',
      lockupPeriod: 0,
      complexity: 'beginner',
      composition: [
        {
          protocol: 'Lido',
          operation: 'stake-eth',
          allocation: 100,
        },
      ],
    },
    {
      id: 'leverage-farming-5',
      name: 'Leveraged Yield Farming',
      description: 'Use leverage to amplify yield in high APY protocols',
      protocol: 'Aave',
      expectedAPY: 45.0,
      riskLevel: 'high',
      minInvestment: '10000',
      maxInvestment: '1000000',
      lockupPeriod: 0,
      complexity: 'advanced',
      composition: [
        {
          protocol: 'Aave',
          operation: 'deposit-collateral',
          allocation: 40,
        },
        {
          protocol: 'Aave',
          operation: 'borrow-usdc',
          allocation: 40,
        },
        {
          protocol: 'Curve',
          operation: 'farm',
          allocation: 20,
        },
      ],
    },
    {
      id: 'dca-strategy-6',
      name: 'Dollar Cost Averaging',
      description: 'Automated DCA into yield-bearing assets',
      protocol: 'Multiple',
      expectedAPY: 8.5,
      riskLevel: 'medium',
      minInvestment: '100',
      maxInvestment: '10000000',
      lockupPeriod: 604800, // 1 week
      complexity: 'intermediate',
      composition: [
        {
          protocol: 'Uniswap',
          operation: 'swap-dca',
          allocation: 50,
        },
        {
          protocol: 'Aave',
          operation: 'deposit',
          allocation: 50,
        },
      ],
    },
    {
      id: 'multi-chain-diversification-7',
      name: 'Multi-Chain Diversification',
      description:
        'Diversify across multiple chains for better risk management',
      protocol: 'Multiple',
      expectedAPY: 9.2,
      riskLevel: 'medium',
      minInvestment: '5000',
      maxInvestment: '5000000',
      lockupPeriod: 0,
      complexity: 'advanced',
      composition: [
        {
          protocol: 'Aave',
          operation: 'deposit',
          allocation: 35,
        },
        {
          protocol: 'Compound',
          operation: 'deposit',
          allocation: 35,
        },
        {
          protocol: 'Yearn',
          operation: 'deposit-vault',
          allocation: 30,
        },
      ],
    },
  ];

  constructor(
    @InjectRepository(DeFiStrategyEntity)
    private strategyRepository: Repository<DeFiStrategyEntity>,
    @InjectRepository(DeFiPositionEntity)
    private positionRepository: Repository<DeFiPositionEntity>,
  ) {}

  /**
   * Get all available yield strategies
   */
  async getStrategies(filters?: StrategyFilter): Promise<YieldStrategy[]> {
    try {
      let strategies = [...this.predefinedStrategies];

      // Apply filters
      if (filters?.minAPY) {
        strategies = strategies.filter(
          (s) => s.expectedAPY >= filters.minAPY!,
        );
      }

      if (filters?.maxAPY) {
        strategies = strategies.filter(
          (s) => s.expectedAPY <= filters.maxAPY!,
        );
      }

      if (filters?.maxRiskLevel) {
        const riskLevels = ['low', 'medium', 'high', 'critical'];
        const maxIndex = riskLevels.indexOf(filters.maxRiskLevel);
        strategies = strategies.filter(
          (s) => riskLevels.indexOf(s.riskLevel) <= maxIndex,
        );
      }

      if (filters?.complexity) {
        strategies = strategies.filter(
          (s) => s.complexity === filters.complexity,
        );
      }

      if (filters?.protocols && filters.protocols.length > 0) {
        strategies = strategies.filter((s) =>
          filters.protocols!.includes(s.protocol),
        );
      }

      return strategies;
    } catch (error) {
      this.logger.error(`Failed to get strategies: ${error}`);
      throw error;
    }
  }

  /**
   * Recommend strategies based on user profile
   */
  async recommendStrategies(
    userId: string,
    budget: string,
  ): Promise<StrategyRecommendation[]> {
    try {
      // Get user's existing positions to understand risk tolerance
      const positions = await this.positionRepository.find({
        where: { userId, status: 'active' },
      });

      const budgetAmount = parseFloat(budget);
      let riskTolerance: 'low' | 'medium' | 'high' = 'medium';

      if (positions.length === 0) {
        riskTolerance = 'low'; // New user, conservative
      } else {
        // Analyze existing positions to infer risk tolerance
        const hasHighRisk = positions.some(
          (p) => p.riskLevel === 'high' || (p.borrowed && parseFloat(p.borrowed) > 0),
        );
        const avgAPY =
          positions.reduce((acc, p) => acc + (p.apy || 0), 0) /
          positions.length;

        if (avgAPY > 20 || hasHighRisk) {
          riskTolerance = 'high';
        } else if (avgAPY > 8) {
          riskTolerance = 'medium';
        } else {
          riskTolerance = 'low';
        }
      }

      // Get appropriate strategies
      const filters: StrategyFilter = {
        maxRiskLevel: riskTolerance,
        minAPY: this.getMinAPYByRiskTolerance(riskTolerance),
      };

      let strategies = await this.getStrategies(filters);

      // Further filter by budget
      strategies = strategies.filter(
        (s) =>
          parseFloat(s.minInvestment) <= budgetAmount &&
          parseFloat(s.maxInvestment) >= budgetAmount,
      );

      // Score and rank
      const recommendations = strategies.map((strategy) => ({
        ...strategy,
        score: this.scoreStrategyForUser(
          strategy,
          budgetAmount,
          riskTolerance,
          positions,
        ),
        matchReason: this.generateMatchReason(strategy, riskTolerance),
        estimatedReturn: (
          budgetAmount *
          (strategy.expectedAPY / 100)
        ).toFixed(2),
      }));

      // Sort by score and return top 5
      return recommendations
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
    } catch (error) {
      this.logger.error(`Failed to recommend strategies: ${error}`);
      throw error;
    }
  }

  /**
   * Score strategy for user
   */
  private scoreStrategyForUser(
    strategy: YieldStrategy,
    budget: number,
    riskTolerance: 'low' | 'medium' | 'high',
    existingPositions: DeFiPositionEntity[],
  ): number {
    let score = 0;

    // Base APY score (normalized to 100)
    score += Math.min(strategy.expectedAPY, 50) * 0.5;

    // Risk alignment score
    const riskMap = { low: 100, medium: 70, high: 40 };
    const toleranceMap = { low: 100, medium: 70, high: 40 };
    const riskScore = Math.abs(riskMap[strategy.riskLevel] - toleranceMap[riskTolerance]) / 100;
    score += (1 - riskScore) * 30;

    // Diversification bonus
    const protocolsInUse = new Set(
      existingPositions.map((p) => p.protocol),
    );
    if (!protocolsInUse.has(strategy.protocol)) {
      score += 20; // Bonus for diversification
    }

    // Budget fit score
    const budgetFit =
      (budget - parseFloat(strategy.minInvestment)) /
      (parseFloat(strategy.maxInvestment) -
        parseFloat(strategy.minInvestment));
    score += Math.min(Math.max(budgetFit, 0), 1) * 20;

    return Math.min(score, 100);
  }

  /**
   * Generate match reason for strategy recommendation
   */
  private generateMatchReason(
    strategy: YieldStrategy,
    riskTolerance: 'low' | 'medium' | 'high',
  ): string {
    if (riskTolerance === 'low' && strategy.riskLevel === 'low') {
      return `Safe yield strategy matching your risk preference at ${strategy.expectedAPY}% APY`;
    }

    if (riskTolerance === 'high' && strategy.riskLevel === 'high') {
      return `High-yield opportunity designed for experienced users at ${strategy.expectedAPY}% APY`;
    }

    return `Well-balanced strategy offering ${strategy.expectedAPY}% APY with ${strategy.riskLevel} risk`;
  }

  /**
   * Get minimum APY by risk tolerance
   */
  private getMinAPYByRiskTolerance(riskTolerance: string): number {
    switch (riskTolerance) {
      case 'low':
        return 3;
      case 'medium':
        return 6;
      case 'high':
        return 15;
      default:
        return 5;
    }
  }

  /**
   * Save custom strategy
   */
  async saveCustomStrategy(
    userId: string,
    strategy: YieldStrategy,
  ): Promise<DeFiStrategyEntity> {
    try {
      const entity = this.strategyRepository.create({
        userId,
        name: strategy.name,
        description: strategy.description,
        protocol: strategy.protocol,
        expectedAPY: strategy.expectedAPY,
        riskLevel: strategy.riskLevel,
        minInvestment: strategy.minInvestment,
        maxInvestment: strategy.maxInvestment,
        lockupPeriod: strategy.lockupPeriod,
        complexity: strategy.complexity,
        composition: strategy.composition,
        status: 'active',
      });

      return this.strategyRepository.save(entity);
    } catch (error) {
      this.logger.error(`Failed to save strategy: ${error}`);
      throw error;
    }
  }
}

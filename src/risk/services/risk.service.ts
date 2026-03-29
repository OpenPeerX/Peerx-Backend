import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RiskProfile } from '../entities/risk-profile.entity';
import { AssetAllocation } from '../../portfolio/dto/portfolio-summary.dto';
import { StressTestResultDto } from '../../portfolio/dto/portfolio-risk.dto';

export interface StressTestScenario {
  name: string;
  description: string;
  assetShocks: Record<string, number>;
  marketShock: number;
}

export interface DiversificationAnalysis {
  isDiversified: boolean;
  score: number;
  recommendations: string[];
}

@Injectable()
export class RiskService {
  private readonly logger = new Logger(RiskService.name);

  // Annualized Volatility Estimates (%)
  private readonly ASSET_VOLATILITY: Record<string, number> = {
    BTC: 80, ETH: 90, USDT: 1, USDC: 1, BNB: 75,
    SOL: 95, XRP: 85, ADA: 88, DOGE: 120, DOT: 90,
  };

  private readonly Z_SCORES = {
    95: 1.645,
    99: 2.326,
  };

  constructor(
    @InjectRepository(RiskProfile)
    private readonly riskProfileRepository: Repository<RiskProfile>,
  ) {}

  async getOrCreateProfile(userId: number): Promise<RiskProfile> {
    let profile = await this.riskProfileRepository.findOne({ where: { userId } });
    if (!profile) {
      profile = this.riskProfileRepository.create({ userId });
      await this.riskProfileRepository.save(profile);
    }
    return profile;
  }

  calculatePortfolioVolatility(assets: AssetAllocation[]): number {
    let weightedVol = 0;
    let totalWeight = 0;
    for (const asset of assets) {
      const weight = asset.allocationPercentage / 100;
      const vol = this.ASSET_VOLATILITY[asset.symbol] || 60;
      weightedVol += weight * vol;
      totalWeight += weight;
    }
    return totalWeight > 0 ? weightedVol / totalWeight : 0;
  }

  calculateParametricVaR(
    portfolioValue: number,
    annualVolatility: number,
    confidenceLevel: 95 | 99 = 95,
    days: number = 1,
  ): number {
    const zScore = this.Z_SCORES[confidenceLevel];
    const dailyVol = (annualVolatility / 100) / Math.sqrt(365);
    const periodVol = dailyVol * Math.sqrt(days);
    return Number((portfolioValue * periodVol * zScore).toFixed(2));
  }

  calculateCVaR(
    portfolioValue: number,
    annualVolatility: number,
    confidenceLevel: 95 | 99 = 95,
  ): number {
    const alpha = 1 - (confidenceLevel / 100);
    const zScore = this.Z_SCORES[confidenceLevel];
    const pdf = (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * Math.pow(zScore, 2));
    const dailyVol = (annualVolatility / 100) / Math.sqrt(365);
    const cvarFactor = pdf / alpha;
    return Number((portfolioValue * dailyVol * cvarFactor).toFixed(2));
  }

  calculateSharpeRatio(expectedReturn: number, riskFreeRate: number, volatility: number): number {
    if (volatility === 0) return 0;
    return Number(((expectedReturn - riskFreeRate) / volatility).toFixed(4));
  }

  calculateDrawdown(peakValue: number, currentValue: number): number {
    if (peakValue <= 0) return 0;
    const drop = peakValue - currentValue;
    return drop > 0 ? Number((drop / peakValue).toFixed(4)) : 0;
  }

  analyzeDiversification(assets: AssetAllocation[], positionLimit: number = 0.25): DiversificationAnalysis {
    const recommendations: string[] = [];
    let overexposedCount = 0;
    
    for (const asset of assets) {
      const weight = asset.allocationPercentage / 100;
      if (weight > positionLimit) {
        overexposedCount++;
        recommendations.push(`Reduce exposure to ${asset.symbol} (currently ${(weight * 100).toFixed(1)}%, limit is ${(positionLimit * 100).toFixed(1)}%)`);
      }
    }

    if (assets.length < 3) {
      recommendations.push('Consider adding more assets to your portfolio to reduce idiosyncratic risk.');
    }

    const isDiversified = overexposedCount === 0 && assets.length >= 3;
    const score = Math.max(0, 100 - (overexposedCount * 20) - (assets.length < 3 ? 30 : 0));

    return {
      isDiversified,
      score,
      recommendations: recommendations.length > 0 ? recommendations : ['Portfolio is well diversified.'],
    };
  }

  calculatePositionSize(
    portfolioValue: number,
    riskTolerancePerTrade: number, // e.g. 0.01 for 1%
    entryPrice: number,
    stopLossPrice: number,
  ): number {
    if (entryPrice <= stopLossPrice) return 0;
    const riskAmount = portfolioValue * riskTolerancePerTrade;
    const riskPerShare = entryPrice - stopLossPrice;
    if (riskPerShare <= 0) return 0;
    return Number((riskAmount / riskPerShare).toFixed(4));
  }

  performStressTests(portfolioValue: number, assets: AssetAllocation[]): StressTestResultDto[] {
    const scenarios: StressTestScenario[] = [
      {
        name: 'Crypto Winter',
        description: 'Major market crash across all crypto assets',
        assetShocks: { USDT: -0.02, USDC: -0.01 },
        marketShock: -0.60,
      },
      {
        name: 'Stablecoin Depeg',
        description: 'Major stablecoin loses peg',
        assetShocks: { USDT: -0.30, USDC: -0.10, DAI: -0.10 },
        marketShock: -0.20,
      },
    ];

    return scenarios.map((scenario) => {
      let projectedValue = 0;
      for (const asset of assets) {
        const shock = scenario.assetShocks[asset.symbol] !== undefined
          ? scenario.assetShocks[asset.symbol]
          : scenario.marketShock;
        projectedValue += asset.value * (1 + shock);
      }
      const projectedPnL = projectedValue - portfolioValue;
      return {
        scenarioName: scenario.name,
        description: scenario.description,
        projectedValue: Number(projectedValue.toFixed(2)),
        projectedPnL: Number(projectedPnL.toFixed(2)),
        percentageChange: Number(((projectedPnL / portfolioValue) * 100).toFixed(2)),
      };
    });
  }
}

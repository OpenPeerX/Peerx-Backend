import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PortfolioOptimizationEntity, OptimizationStatus, RiskTolerance } from '../entities/portfolio-optimization.entity';
import { MarketPredictionEntity } from '../entities/market-prediction.entity';
import { OptimizationRequestDto } from '../dto/optimization-request.dto';
import { OptimizationResponseDto, AssetAllocationDto, OptimizationMetricsDto } from '../dto/optimization-response.dto';

interface AssetData {
  symbol: string;
  expectedReturn: number;
  risk: number;
  currentAllocation: number;
  price: number;
}

interface OptimizationResult {
  allocations: Record<string, number>;
  expectedReturn: number;
  expectedRisk: number;
  sharpeRatio: number;
}

@Injectable()
export class PortfolioOptimizerService {
  private readonly logger = new Logger(PortfolioOptimizerService.name);

  constructor(
    @InjectRepository(PortfolioOptimizationEntity)
    private readonly optimizationRepository: Repository<PortfolioOptimizationEntity>,
    @InjectRepository(MarketPredictionEntity)
    private readonly predictionRepository: Repository<MarketPredictionEntity>,
  ) {}

  async optimizePortfolio(
    userId: string,
    request: OptimizationRequestDto,
    currentAssets: Record<string, number>,
  ): Promise<OptimizationResponseDto> {
    this.logger.log(`Starting portfolio optimization for user ${userId}`);

    try {
      // Create optimization record
      const optimization = this.optimizationRepository.create({
        userId,
        riskTolerance: request.riskTolerance,
        currentAllocation: currentAssets,
        status: OptimizationStatus.PROCESSING,
        constraints: request.constraints,
      });

      const savedOptimization = await this.optimizationRepository.save(optimization);

      // Fetch market predictions
      const assetData = await this.getAssetData(Object.keys(currentAssets), request.useMLPredictions);

      // Run optimization algorithm
      const result = await this.runOptimization(assetData, request);

      // Update optimization with results
      savedOptimization.optimizedAllocation = result.allocations;
      savedOptimization.expectedReturn = result.expectedReturn;
      savedOptimization.expectedRisk = result.expectedRisk;
      savedOptimization.sharpeRatio = result.sharpeRatio;
      savedOptimization.status = OptimizationStatus.COMPLETED;
      savedOptimization.optimizationMetrics = this.calculateOptimizationMetrics(result, assetData);

      await this.optimizationRepository.save(savedOptimization);

      return this.buildResponse(savedOptimization, assetData);
    } catch (error) {
      this.logger.error('Portfolio optimization failed:', error);
      throw error;
    }
  }

  private async getAssetData(symbols: string[], useMLPredictions: boolean): Promise<AssetData[]> {
    const assetData: AssetData[] = [];

    for (const symbol of symbols) {
      let expectedReturn = 0.08; // Default 8% annual return
      let risk = 0.20; // Default 20% annual volatility

      if (useMLPredictions) {
        const prediction = await this.getLatestPrediction(symbol);
        if (prediction) {
          expectedReturn = (prediction.predictedValue - 100) / 100; // Convert to return
          risk = this.estimateRiskFromPrediction(prediction);
        }
      } else {
        // Use historical averages
        expectedReturn = this.getHistoricalAverageReturn(symbol);
        risk = this.getHistoricalRisk(symbol);
      }

      assetData.push({
        symbol,
        expectedReturn,
        risk,
        currentAllocation: 0, // Will be set from currentAssets
        price: 100, // Mock price
      });
    }

    return assetData;
  }

  private async getLatestPrediction(symbol: string): Promise<MarketPredictionEntity | null> {
    return this.predictionRepository.findOne({
      where: { assetSymbol: symbol },
      order: { createdAt: 'DESC' },
    });
  }

  private estimateRiskFromPrediction(prediction: MarketPredictionEntity): number {
    // Estimate risk from prediction confidence and bounds
    const range = (prediction.upperBound - prediction.lowerBound) / prediction.predictedValue;
    return Math.max(0.05, range * 0.5); // Minimum 5% risk
  }

  private getHistoricalAverageReturn(symbol: string): number {
    // Mock historical returns - in production, fetch from database
    const returns: Record<string, number> = {
      BTC: 0.15,
      ETH: 0.20,
      AAPL: 0.12,
      GOOGL: 0.10,
      MSFT: 0.11,
    };
    return returns[symbol] || 0.08;
  }

  private getHistoricalRisk(symbol: string): number {
    // Mock historical risk - in production, calculate from historical data
    const risks: Record<string, number> = {
      BTC: 0.45,
      ETH: 0.50,
      AAPL: 0.25,
      GOOGL: 0.22,
      MSFT: 0.20,
    };
    return risks[symbol] || 0.20;
  }

  private async runOptimization(
    assetData: AssetData[],
    request: OptimizationRequestDto,
  ): Promise<OptimizationResult> {
    const riskFreeRate = 0.02; // 2% risk-free rate

    switch (request.riskTolerance) {
      case RiskTolerance.CONSERVATIVE:
        return this.conservativeOptimization(assetData, riskFreeRate);
      case RiskTolerance.MODERATE:
        return this.moderateOptimization(assetData, riskFreeRate);
      case RiskTolerance.AGGRESSIVE:
        return this.aggressiveOptimization(assetData, riskFreeRate);
      case RiskTolerance.VERY_AGGRESSIVE:
        return this.veryAggressiveOptimization(assetData, riskFreeRate);
      default:
        return this.moderateOptimization(assetData, riskFreeRate);
    }
  }

  private conservativeOptimization(assetData: AssetData[], riskFreeRate: number): OptimizationResult {
    // Focus on capital preservation with low volatility
    const filteredAssets = assetData.filter(asset => asset.risk < 0.25);
    
    if (filteredAssets.length === 0) {
      filteredAssets.push(...assetData.sort((a, b) => a.risk - b.risk).slice(0, 3));
    }

    return this.meanVarianceOptimization(filteredAssets, riskFreeRate, { maxRisk: 0.15 });
  }

  private moderateOptimization(assetData: AssetData[], riskFreeRate: number): OptimizationResult {
    // Balanced approach with moderate risk
    return this.meanVarianceOptimization(assetData, riskFreeRate, { maxRisk: 0.20 });
  }

  private aggressiveOptimization(assetData: AssetData[], riskFreeRate: number): OptimizationResult {
    // Focus on higher returns with higher risk tolerance
    return this.meanVarianceOptimization(assetData, riskFreeRate, { maxRisk: 0.30 });
  }

  private veryAggressiveOptimization(assetData: AssetData[], riskFreeRate: number): OptimizationResult {
    // Maximum return focus with high risk tolerance
    return this.meanVarianceOptimization(assetData, riskFreeRate, { maxRisk: 0.40 });
  }

  private meanVarianceOptimization(
    assets: AssetData[],
    riskFreeRate: number,
    constraints: { maxRisk: number },
  ): OptimizationResult {
    // Simplified mean-variance optimization
    // In production, this would use proper optimization libraries

    const numAssets = assets.length;
    const allocations: Record<string, number> = {};

    // Calculate expected returns and covariance matrix (simplified)
    const expectedReturns = assets.map(a => a.expectedReturn);
    const covariances = this.calculateCovarianceMatrix(assets);

    // Equal weight allocation as baseline
    const equalWeight = 1 / numAssets;
    assets.forEach(asset => {
      allocations[asset.symbol] = equalWeight;
    });

    // Calculate portfolio metrics
    const portfolioReturn = expectedReturns.reduce((sum, ret, i) => sum + ret * equalWeight, 0);
    const portfolioRisk = this.calculatePortfolioRisk(allocations, assets, covariances);

    // Adjust allocations based on risk tolerance
    if (portfolioRisk > constraints.maxRisk) {
      // Reduce risk by allocating more to low-risk assets
      const sortedByRisk = assets.sort((a, b) => a.risk - b.risk);
      const lowRiskAssets = sortedByRisk.slice(0, Math.ceil(numAssets / 2));
      
      // Reset allocations
      Object.keys(allocations).forEach(key => allocations[key] = 0);
      
      // Allocate to low-risk assets
      const lowRiskWeight = 1 / lowRiskAssets.length;
      lowRiskAssets.forEach(asset => {
        allocations[asset.symbol] = lowRiskWeight;
      });
    }

    const finalReturn = this.calculatePortfolioReturn(allocations, assets);
    const finalRisk = this.calculatePortfolioRisk(allocations, assets, covariances);
    const sharpeRatio = (finalReturn - riskFreeRate) / finalRisk;

    return {
      allocations,
      expectedReturn: finalReturn,
      expectedRisk: finalRisk,
      sharpeRatio,
    };
  }

  private calculateCovarianceMatrix(assets: AssetData[]): number[][] {
    const n = assets.length;
    const matrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = assets[i].risk * assets[i].risk; // Variance
        } else {
          // Simplified correlation - in production, calculate from historical data
          const correlation = 0.3 + Math.random() * 0.4; // 0.3 to 0.7
          matrix[i][j] = correlation * assets[i].risk * assets[j].risk;
        }
      }
    }

    return matrix;
  }

  private calculatePortfolioReturn(allocations: Record<string, number>, assets: AssetData[]): number {
    return assets.reduce((sum, asset) => {
      return sum + (allocations[asset.symbol] || 0) * asset.expectedReturn;
    }, 0);
  }

  private calculatePortfolioRisk(
    allocations: Record<string, number>,
    assets: AssetData[],
    covariances: number[][],
  ): number {
    const n = assets.length;
    let portfolioVariance = 0;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        portfolioVariance += (allocations[assets[i].symbol] || 0) * 
                           (allocations[assets[j].symbol] || 0) * 
                           covariances[i][j];
      }
    }

    return Math.sqrt(portfolioVariance);
  }

  private calculateOptimizationMetrics(result: OptimizationResult, assetData: AssetData[]): Record<string, any> {
    return {
      optimizationAlgorithm: 'mean_variance',
      riskFreeRate: 0.02,
      assetsConsidered: assetData.length,
      constraints: {
        maxRisk: 0.25,
        minAllocation: 0.01,
        maxAllocation: 0.40,
      },
      diversificationScore: this.calculateDiversificationScore(result.allocations, assetData),
      turnoverRate: this.calculateTurnoverRate(result.allocations, assetData),
    };
  }

  private calculateDiversificationScore(allocations: Record<string, number>, assets: AssetData[]): number {
    const weights = Object.values(allocations);
    const herfindahlIndex = weights.reduce((sum, w) => sum + w * w, 0);
    return 1 - herfindahlIndex; // Higher is more diversified
  }

  private calculateTurnoverRate(allocations: Record<string, number>, assets: AssetData[]): number {
    // Calculate turnover from current to target allocation
    let turnover = 0;
    assets.forEach(asset => {
      const currentWeight = asset.currentAllocation || 0;
      const targetWeight = allocations[asset.symbol] || 0;
      turnover += Math.abs(targetWeight - currentWeight);
    });
    return turnover / 2; // Divide by 2 to avoid double counting
  }

  private buildResponse(
    optimization: PortfolioOptimizationEntity,
    assetData: AssetData[],
  ): OptimizationResponseDto {
    const assetAllocations: AssetAllocationDto[] = Object.entries(optimization.optimizedAllocation).map(
      ([symbol, allocation]) => {
        const asset = assetData.find(a => a.symbol === symbol);
        const currentAllocation = optimization.currentAllocation[symbol] || 0;
        
        return {
          symbol,
          name: this.getAssetName(symbol),
          currentAllocation: currentAllocation * 100,
          recommendedAllocation: allocation * 100,
          allocationChange: (allocation - currentAllocation) * 100,
          expectedReturn: asset?.expectedReturn || 0,
          expectedRisk: asset?.risk || 0,
          weight: allocation,
        };
      },
    );

    const metrics: OptimizationMetricsDto = {
      expectedReturn: optimization.expectedReturn * 100,
      expectedRisk: optimization.expectedRisk * 100,
      sharpeRatio: optimization.sharpeRatio,
      beta: this.calculatePortfolioBeta(optimization.optimizedAllocation, assetData),
      var95: this.calculateVaR(optimization.expectedReturn, optimization.expectedRisk, 0.95),
      cvar95: this.calculateCVaR(optimization.expectedReturn, optimization.expectedRisk, 0.95),
      maxDrawdown: this.calculateMaxDrawdown(optimization.expectedRisk),
      diversificationRatio: optimization.optimizationMetrics?.diversificationScore || 0,
      turnoverRate: optimization.optimizationMetrics?.turnoverRate || 0,
    };

    return {
      id: optimization.id,
      riskTolerance: optimization.riskTolerance,
      status: optimization.status,
      assetAllocations,
      metrics,
      createdAt: optimization.createdAt,
      updatedAt: optimization.updatedAt,
      executedAt: optimization.executedAt,
      errorMessage: optimization.errorMessage,
      metadata: optimization.optimizationMetrics,
    };
  }

  private getAssetName(symbol: string): string {
    const names: Record<string, string> = {
      BTC: 'Bitcoin',
      ETH: 'Ethereum',
      AAPL: 'Apple Inc.',
      GOOGL: 'Alphabet Inc.',
      MSFT: 'Microsoft Corporation',
    };
    return names[symbol] || symbol;
  }

  private calculatePortfolioBeta(allocations: Record<string, number>, assets: AssetData[]): number {
    // Mock beta calculation - in production, calculate relative to market
    const betas: Record<string, number> = {
      BTC: 1.2,
      ETH: 1.5,
      AAPL: 1.0,
      GOOGL: 1.1,
      MSFT: 0.9,
    };

    return assets.reduce((sum, asset) => {
      return sum + (allocations[asset.symbol] || 0) * (betas[asset.symbol] || 1.0);
    }, 0);
  }

  private calculateVaR(expectedReturn: number, risk: number, confidence: number): number {
    // Value at Risk calculation
    const zScore = this.getZScore(confidence);
    return expectedReturn - zScore * risk;
  }

  private calculateCVaR(expectedReturn: number, risk: number, confidence: number): number {
    // Conditional Value at Risk (Expected Shortfall)
    const zScore = this.getZScore(confidence);
    return expectedReturn - (zScore + 0.4) * risk; // Simplified CVaR
  }

  private calculateMaxDrawdown(risk: number): number {
    // Simplified max drawdown estimation
    return risk * 2.5; // Historical approximation
  }

  private getZScore(confidence: number): number {
    // Standard normal distribution z-scores
    const zScores: Record<number, number> = {
      0.90: 1.28,
      0.95: 1.65,
      0.99: 2.33,
    };
    return zScores[confidence] || 1.65;
  }
}

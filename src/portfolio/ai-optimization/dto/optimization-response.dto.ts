import { ApiProperty } from '@nestjs/swagger';
import { OptimizationStatus, RiskTolerance } from '../entities/portfolio-optimization.entity';

export class AssetAllocationDto {
  @ApiProperty({ description: 'Asset symbol' })
  symbol: string;

  @ApiProperty({ description: 'Asset name' })
  name: string;

  @ApiProperty({ description: 'Current allocation percentage' })
  currentAllocation: number;

  @ApiProperty({ description: 'Recommended allocation percentage' })
  recommendedAllocation: number;

  @ApiProperty({ description: 'Allocation change percentage' })
  allocationChange: number;

  @ApiProperty({ description: 'Expected annual return' })
  expectedReturn: number;

  @ApiProperty({ description: 'Expected risk (volatility)' })
  expectedRisk: number;

  @ApiProperty({ description: 'Asset weight in portfolio' })
  weight: number;
}

export class OptimizationMetricsDto {
  @ApiProperty({ description: 'Expected annual portfolio return (%)' })
  expectedReturn: number;

  @ApiProperty({ description: 'Expected portfolio risk (volatility) (%)' })
  expectedRisk: number;

  @ApiProperty({ description: 'Sharpe ratio' })
  sharpeRatio: number;

  @ApiProperty({ description: 'Portfolio beta' })
  beta: number;

  @ApiProperty({ description: 'Value at Risk (VaR) at 95% confidence' })
  var95: number;

  @ApiProperty({ description: 'Conditional Value at Risk (CVaR) at 95% confidence' })
  cvar95: number;

  @ApiProperty({ description: 'Maximum drawdown' })
  maxDrawdown: number;

  @ApiProperty({ description: 'Diversification ratio' })
  diversificationRatio: number;

  @ApiProperty({ description: 'Turnover rate' })
  turnoverRate: number;
}

export class BacktestResultsDto {
  @ApiProperty({ description: 'Backtest period start date' })
  startDate: Date;

  @ApiProperty({ description: 'Backtest period end date' })
  endDate: Date;

  @ApiProperty({ description: 'Total return during backtest' })
  totalReturn: number;

  @ApiProperty({ description: 'Annualized return' })
  annualizedReturn: number;

  @ApiProperty({ description: 'Annualized volatility' })
  annualizedVolatility: number;

  @ApiProperty({ description: 'Maximum drawdown during backtest' })
  maxDrawdown: number;

  @ApiProperty({ description: 'Sharpe ratio during backtest' })
  sharpeRatio: number;

  @ApiProperty({ description: 'Number of trades executed' })
  tradesExecuted: number;

  @ApiProperty({ description: 'Win rate percentage' })
  winRate: number;

  @ApiProperty({ description: 'Average holding period in days' })
  averageHoldingPeriod: number;
}

export class OptimizationResponseDto {
  @ApiProperty({ description: 'Optimization ID' })
  id: string;

  @ApiProperty({ description: 'Risk tolerance level', enum: RiskTolerance })
  riskTolerance: RiskTolerance;

  @ApiProperty({ description: 'Optimization status', enum: OptimizationStatus })
  status: OptimizationStatus;

  @ApiProperty({ description: 'Asset allocations', type: [AssetAllocationDto] })
  assetAllocations: AssetAllocationDto[];

  @ApiProperty({ description: 'Optimization metrics' })
  metrics: OptimizationMetricsDto;

  @ApiProperty({ description: 'Backtest results', nullable: true })
  backtestResults?: BacktestResultsDto;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last updated date' })
  updatedAt: Date;

  @ApiProperty({ description: 'Execution date', nullable: true })
  executedAt?: Date;

  @ApiProperty({ description: 'Error message', nullable: true })
  errorMessage?: string;

  @ApiProperty({ description: 'Additional metadata' })
  metadata?: Record<string, any>;
}

/**
 * DeFi DTOs - Data Transfer Objects for API communication
 */

import { IsString, IsNumber, IsOptional, IsEnum, Min, Max, IsDecimal } from 'class-validator';

// Position DTOs
export class CreateDeFiPositionDto {
  @IsString()
  protocol: string;

  @IsEnum(['deposit', 'borrow', 'stake', 'farm'])
  action: 'deposit' | 'borrow' | 'stake' | 'farm';

  @IsString()
  token: string;

  @IsString()
  amount: string;

  @IsOptional()
  @IsString()
  referenceToken?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  leverage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  slippage?: number;

  @IsOptional()
  @IsNumber()
  deadline?: number;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateDeFiPositionDto {
  @IsOptional()
  @IsString()
  amount?: string;

  @IsOptional()
  @IsString()
  riskLevel?: 'low' | 'medium' | 'high';

  @IsOptional()
  metadata?: Record<string, any>;
}

export class DeFiPositionResponseDto {
  id: string;
  protocol: string;
  action: string;
  tokenIn: string;
  amountIn: string;
  apy?: number;
  riskLevel?: string;
  status: string;
  healthFactor?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Transaction Simulation DTOs
export class TransactionSimulationDto {
  @IsString()
  protocol: string;

  @IsString()
  method: string;

  @IsString()
  from: string;

  @IsString()
  to: string;

  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  @IsString()
  data?: string;

  @IsOptional()
  params?: Record<string, any>;
}

export class SimulationResponseDto {
  method: string;
  from: string;
  to: string;
  data: string;
  value: string;
  gasEstimate: string;
  gasPrice: string;
  totalCost: string;
  success: boolean;
  error?: string;
  revertReason?: string;
}

// Analytics DTOs
export class DeFiAnalyticsDto {
  totalValue: string;
  totalDeposited: string;
  totalBorrowed: string;
  totalEarned: string;
  netAPY: number;
  riskScore: number;
  healthFactor: number;
  protocolBreakdown: ProtocolBreakdownDto[];
  positions: DeFiPositionResponseDto[];
}

export class ProtocolBreakdownDto {
  protocol: string;
  value: string;
  percentage: number;
  positions: number;
}

export class ProtocolAnalyticsDto {
  protocol: string;
  tvl: string;
  apy: number;
  activeUsers: number;
  transactions24h: number;
  volume24h: string;
  risk: RiskProfileDto;
}

export class RiskProfileDto {
  score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: string[];
}

// Risk Assessment DTOs
export class RiskAssessmentDto {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  riskFactors: RiskFactorDto[];
  recommendations: string[];
  liquidationRisks: LiquidationRiskDto[];
}

export class RiskFactorDto {
  name: string;
  severity: number;
  impact: string;
  mitigation: string;
}

export class LiquidationRiskDto {
  positionId: string;
  protocol: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  liquidationPrice?: number;
  currPrice: number;
  distance: number;
  timeEstimate?: number;
}

// Yield Strategy DTOs
export class YieldStrategyDto {
  id: string;
  name: string;
  description: string;
  protocol: string;
  expectedAPY: number;
  riskLevel: 'low' | 'medium' | 'high';
  minInvestment: string;
  maxInvestment: string;
  lockupPeriod: number;
  complexity: 'beginner' | 'intermediate' | 'advanced';
  composition: StrategyCompositionDto[];
}

export class StrategyCompositionDto {
  protocol: string;
  operation: string;
  allocation: number;
}

export class StrategyRecommendationDto extends YieldStrategyDto {
  score: number;
  matchReason: string;
  estimatedReturn: string;
}

export class StrategyFilterDto {
  @IsOptional()
  @IsNumber()
  minAPY?: number;

  @IsOptional()
  @IsNumber()
  maxAPY?: number;

  @IsOptional()
  maxRiskLevel?: 'low' | 'medium' | 'high';

  @IsOptional()
  @IsString()
  minLiquidity?: string;

  @IsOptional()
  protocols?: string[];

  @IsOptional()
  complexity?: 'beginner' | 'intermediate' | 'advanced';
}

// Emergency Exit DTOs
export class EmergencyExitDto {
  positionId: string;
  protocol: string;
  currentValue: string;
  estimatedExecutionTime: number;
  estimatedSlippage: number;
  estimatedGas: string;
  steps: ExitStepDto[];
  risks: string[];
}

export class ExitStepDto {
  order: number;
  action: string;
  description: string;
  timeEstimate: number;
}

// Rebalance DTOs
export class PositionRebalanceDto {
  fromPositionId: string;
  toProtocol: string;
  amount: string;
  expectedAPYImprovement: number;
  estimatedCost: string;
}

// Execute Transaction DTOs
export class ExecuteTransactionDto {
  @IsString()
  protocol: string;

  @IsEnum(['deposit', 'borrow', 'stake', 'farm', 'withdraw'])
  action: string;

  @IsString()
  token: string;

  @IsString()
  amount: string;

  @IsOptional()
  @IsNumber()
  gasPrice?: number;

  @IsOptional()
  @IsNumber()
  gasLimit?: number;

  @IsOptional()
  @IsString()
  maxFeePerGas?: string;

  @IsOptional()
  @IsString()
  maxPriorityFeePerGas?: string;

  @IsOptional()
  simulateFirst?: boolean;
}

// Query/Filter DTOs
export class PositionFilterDto {
  @IsOptional()
  @IsString()
  protocol?: string;

  @IsOptional()
  @IsEnum(['active', 'closed', 'liquidated'])
  status?: 'active' | 'closed' | 'liquidated';

  @IsOptional()
  @IsNumber()
  minAge?: number;

  @IsOptional()
  maxRiskLevel?: 'low' | 'medium' | 'high';

  @IsOptional()
  @IsNumber()
  minAPY?: number;
}

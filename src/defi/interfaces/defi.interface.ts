/**
 * DeFi Service Interface - Core DeFi operations
 */

import { DeFiPosition, RiskMetrics, TransactionSimulation, YieldInfo } from './protocol.interface';

export interface IDeFiService {
  // Position management
  createPosition(req: CreatePositionRequest): Promise<DeFiPosition>;
  getPosition(userId: string, positionId: string): Promise<DeFiPosition>;
  getPositions(userId: string, filters?: PositionFilter): Promise<DeFiPosition[]>;
  updatePosition(userId: string, positionId: string, updates: Partial<DeFiPosition>): Promise<DeFiPosition>;
  closePosition(userId: string, positionId: string): Promise<string>; // tx hash
  emergencyExit(userId: string, positionId: string): Promise<string>;

  // Transaction simulation and execution
  simulateTransaction(req: TransactionSimulationRequest): Promise<TransactionSimulation>;
  executeTransaction(userId: string, req: ExecuteTransactionRequest): Promise<string>;
  optimizeGas(req: TransactionSimulationRequest): Promise<TransactionSimulation>;

  // Analytics and monitoring
  getPortfolioAnalytics(userId: string): Promise<DeFiPortfolioAnalytics>;
  getProtocolAnalytics(protocol: string): Promise<ProtocolAnalytics>;
  getRiskAssessment(userId: string): Promise<PortfolioRiskAssessment>;

  // Yield strategies
  getYieldStrategies(filters?: StrategyFilter): Promise<YieldStrategy[]>;
  recommendStrategies(userId: string, budget: string): Promise<StrategyRecommendation[]>;
  executeStrategy(userId: string, strategyId: string): Promise<string>;

  // Emergency and risk management
  getEmergencyExitPlan(userId: string, positionId: string): Promise<EmergencyExitPlan>;
  checkLiquidationRisk(userId: string): Promise<LiquidationRisk[]>;
  rebalancePositions(userId: string): Promise<PositionRebalance>;
}

export interface CreatePositionRequest {
  userId: string;
  protocol: string;
  action: 'deposit' | 'borrow' | 'stake' | 'farm';
  token: string;
  amount: string;
  referenceToken?: string;
  leverage?: number;
  slippage?: number;
  deadline?: number;
  params?: Record<string, any>;
}

export interface ExecuteTransactionRequest extends CreatePositionRequest {
  gasPrice?: string;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  approveFirst?: boolean;
  simulateFirst?: boolean;
}

export interface TransactionSimulationRequest {
  protocol: string;
  method: string;
  from: string;
  to: string;
  value?: string;
  params?: Record<string, any>;
  data?: string;
}

export interface PositionFilter {
  protocol?: string;
  status?: 'active' | 'closed' | 'liquidated';
  minAge?: number; // seconds
  maxRiskLevel?: 'low' | 'medium' | 'high';
  minAPY?: number;
}

export interface DeFiPortfolioAnalytics {
  totalValue: string;
  totalDeposited: string;
  totalBorrowed: string;
  totalEarned: string;
  netAPY: number;
  protocolBreakdown: ProtocolBreakdown[];
  riskScore: number;
  positions: DeFiPosition[];
  healthFactor: number;
}

export interface ProtocolBreakdown {
  protocol: string;
  value: string;
  percentage: number;
  positions: number;
}

export interface ProtocolAnalytics {
  protocol: string;
  tvl: string;
  apy: number;
  apyBands: APYBand[];
  activeUsers: number;
  transactions24h: number;
  volume24h: string;
  risk: RiskProfile;
}

export interface APYBand {
  range: string;
  apy: number;
  providers: number;
}

export interface RiskProfile {
  score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: string[];
  audits: AuditInfo[];
}

export interface AuditInfo {
  firm: string;
  date: string;
  report: string;
  severity?: string;
}

export interface PortfolioRiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  riskFactors: RiskFactor[];
  recommendations: string[];
  liquidationRisks: LiquidationRisk[];
}

export interface RiskFactor {
  name: string;
  severity: number;
  impact: string;
  mitigation: string;
}

export interface LiquidationRisk {
  positionId: string;
  protocol: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  liquidationPrice?: number;
  currPrice: number;
  distance: number; // percentage
  timeEstimate?: number; // seconds until liquidation
}

export interface YieldStrategy {
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
  composition: StrategyComposition[];
}

export interface StrategyComposition {
  protocol: string;
  operation: string;
  allocation: number; // percentage
}

export interface StrategyFilter {
  minAPY?: number;
  maxAPY?: number;
  maxRiskLevel?: 'low' | 'medium' | 'high';
  minLiquidity?: string;
  protocols?: string[];
  complexity?: 'beginner' | 'intermediate' | 'advanced';
}

export interface StrategyRecommendation extends YieldStrategy {
  score: number;
  matchReason: string;
  estimatedReturn: string;
}

export interface EmergencyExitPlan {
  positionId: string;
  protocol: string;
  currentValue: string;
  estimatedExecutionTime: number;
  estimatedSlippage: number;
  estimatedGas: string;
  steps: ExitStep[];
  risks: string[];
}

export interface ExitStep {
  order: number;
  action: string;
  description: string;
  dependencies?: number[];
  timeEstimate: number;
}

export interface PositionRebalance {
  fromPositionId: string;
  toProtocol: string;
  amount: string;
  expectedAPYImprovement: number;
  executionSteps: string[];
  estimatedCost: string;
  riskAdjustment: number;
}

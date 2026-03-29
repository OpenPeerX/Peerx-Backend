/**
 * Protocol Interface - Common interface for all DeFi protocol integrations
 */

export interface IProtocol {
  name: string;
  version: string;
  contractAddress: string;
  chainId: number;

  // Core operations
  deposit(token: string, amount: string, params?: any): Promise<string>;
  withdraw(positionId: string, amount: string, params?: any): Promise<string>;
  borrow(token: string, amount: string, params?: any): Promise<string>;
  repay(positionId: string, amount: string, params?: any): Promise<string>;

  // Position management
  getPositions(address: string): Promise<DeFiPosition[]>;
  getPosition(positionId: string): Promise<DeFiPosition>;
  closePosition(positionId: string): Promise<string>;

  // Pricing and calculations
  getPrice(token: string): Promise<number>;
  getPrices(tokens: string[]): Promise<Record<string, number>>;
  estimateGas(method: string, params?: any): Promise<string>;
  simulateTransaction(method: string, params?: any): Promise<TransactionSimulation>;

  // Yield and rewards
  getYield(positionId: string): Promise<YieldInfo>;
  getRewards(address: string): Promise<Reward[]>;
  claimRewards(positionId: string): Promise<string>;

  // Risk metrics
  getRiskMetrics(positionId: string): Promise<RiskMetrics>;
  getHealthFactor(positionId: string): Promise<number>;
  getLiquidationThreshold(positionId: string): Promise<number>;
}

export interface DeFiPosition {
  id: string;
  protocol: string;
  userAddress: string;
  tokenIn: string;
  tokenOut?: string;
  amountIn: string;
  amountOut?: string;
  shares?: string;
  startTimestamp: number;
  endTimestamp?: number;
  status: 'active' | 'closed' | 'liquidated';
  apy?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  collateral?: string;
  borrowed?: string;
  healthFactor?: number;
  metadata?: Record<string, any>;
}

export interface YieldInfo {
  apy: number;
  apr: number;
  earned: string;
  pending: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'continuous';
}

export interface Reward {
  token: string;
  amount: string;
  value: number;
  claimable: boolean;
}

export interface RiskMetrics {
  positionId: string;
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high';
  liquidationPrice?: number;
  liquidationDistance?: number;
  volatilityScore: number;
  correlationScore: number;
  concentrationRisk: number;
}

export interface TransactionSimulation {
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

export interface ProtocolConfig {
  name: string;
  enabled: boolean;
  contractAddress: string;
  chainId: number;
  abiPath?: string;
  rpcUrl?: string;
  subgraphUrl?: string;
  maxLeverage?: number;
  minAmount?: string;
  maxAmount?: string;
}

export enum ProtocolType {
  LENDING = 'lending',
  YIELD = 'yield',
  LIQUID_STAKING = 'liquid-staking',
  DEX = 'dex',
  DERIVATIVES = 'derivatives',
  INSURANCE = 'insurance',
}

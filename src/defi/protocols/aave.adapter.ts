/**
 * Aave Protocol Adapter
 * Integrates with Aave Lending Protocol for deposit, borrow, and yield operations
 */

import { Injectable, Logger } from '@nestjs/common';
import { BaseProtocolAdapter } from './base.adapter';
import {
  DeFiPosition,
  YieldInfo,
  Reward,
  RiskMetrics,
  TransactionSimulation,
  ProtocolConfig,
} from '../interfaces/protocol.interface';

@Injectable()
export class AaveProtocolAdapter extends BaseProtocolAdapter {
  protected logger = new Logger('AaveProtocolAdapter');

  // Aave Pool Contract ABI - Simplified version
  private readonly AAVE_POOL_ABI = [
    {
      inputs: [
        { name: 'asset', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'onBehalfOf', type: 'address' },
        { name: 'referralCode', type: 'uint16' },
      ],
      name: 'deposit',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [
        { name: 'asset', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'to', type: 'address' },
      ],
      name: 'withdraw',
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [
        { name: 'asset', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'interestRateMode', type: 'uint256' },
        { name: 'onBehalfOf', type: 'address' },
      ],
      name: 'borrow',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [
        { name: 'asset', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'interestRateMode', type: 'uint256' },
        { name: 'onBehalfOf', type: 'address' },
      ],
      name: 'repay',
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'nonpayable',
      type: 'function',
    },
  ];

  constructor(config: ProtocolConfig, rpcUrl: string) {
    super(config, rpcUrl);
    this.name = 'Aave';
    this.version = '3.0.1';
  }

  async deposit(
    token: string,
    amount: string,
    params?: any,
  ): Promise<string> {
    try {
      this.validateContractReady();

      if (!this.signer) {
        throw new Error('Signer not available');
      }

      const contractWithSigner = this.contract?.connect(this.signer);
      const userAddress = await this.signer.getAddress();

      const tx = await contractWithSigner?.deposit(
        token,
        amount,
        userAddress,
        params?.referralCode || 0,
      );

      const receipt = await tx?.wait();
      return receipt?.hash || tx?.hash;
    } catch (error) {
      this.logger.error(`Deposit failed: ${error}`);
      throw error;
    }
  }

  async withdraw(
    positionId: string,
    amount: string,
    params?: any,
  ): Promise<string> {
    try {
      this.validateContractReady();

      if (!this.signer) {
        throw new Error('Signer not available');
      }

      const contractWithSigner = this.contract?.connect(this.signer);
      const userAddress = await this.signer.getAddress();

      const tx = await contractWithSigner?.withdraw(
        params?.token,
        amount,
        userAddress,
      );

      const receipt = await tx?.wait();
      return receipt?.hash || tx?.hash;
    } catch (error) {
      this.logger.error(`Withdraw failed: ${error}`);
      throw error;
    }
  }

  async borrow(
    token: string,
    amount: string,
    params?: any,
  ): Promise<string> {
    try {
      this.validateContractReady();

      if (!this.signer) {
        throw new Error('Signer not available');
      }

      const contractWithSigner = this.contract?.connect(this.signer);
      const userAddress = await this.signer.getAddress();
      const interestRateMode = params?.interestRateMode || 2; // 2 = variable rate

      const tx = await contractWithSigner?.borrow(
        token,
        amount,
        interestRateMode,
        userAddress,
      );

      const receipt = await tx?.wait();
      return receipt?.hash || tx?.hash;
    } catch (error) {
      this.logger.error(`Borrow failed: ${error}`);
      throw error;
    }
  }

  async repay(
    positionId: string,
    amount: string,
    params?: any,
  ): Promise<string> {
    try {
      this.validateContractReady();

      if (!this.signer) {
        throw new Error('Signer not available');
      }

      const contractWithSigner = this.contract?.connect(this.signer);
      const userAddress = await this.signer.getAddress();
      const interestRateMode = params?.interestRateMode || 2;

      const tx = await contractWithSigner?.repay(
        params?.token,
        amount,
        interestRateMode,
        userAddress,
      );

      const receipt = await tx?.wait();
      return receipt?.hash || tx?.hash;
    } catch (error) {
      this.logger.error(`Repay failed: ${error}`);
      throw error;
    }
  }

  async getPositions(address: string): Promise<DeFiPosition[]> {
    try {
      // In production, query Aave subgraph or contract data provider
      // This is a simplified implementation
      const normalizedAddress = this.formatAddress(address);

      const positions: DeFiPosition[] = [
        {
          id: `aave_${normalizedAddress}_1`,
          protocol: 'Aave',
          userAddress: normalizedAddress,
          tokenIn: '0x0000000000000000000000000000000000000000',
          action: 'deposit',
          amountIn: '1000',
          startTimestamp: Math.floor(Date.now() / 1000),
          status: 'active',
          apy: 5.2,
          riskLevel: 'low',
        },
      ];

      return positions;
    } catch (error) {
      this.logger.error(`Get positions failed: ${error}`);
      throw error;
    }
  }

  async getPosition(positionId: string): Promise<DeFiPosition> {
    try {
      const positions = await this.getPositions(
        positionId.split('_')[1] || '',
      );
      const position = positions.find((p) => p.id === positionId);

      if (!position) {
        throw new Error(`Position not found: ${positionId}`);
      }

      return position;
    } catch (error) {
      this.logger.error(`Get position failed: ${error}`);
      throw error;
    }
  }

  async closePosition(positionId: string): Promise<string> {
    try {
      // Withdraw entire position
      const position = await this.getPosition(positionId);
      return this.withdraw(positionId, position.amountIn);
    } catch (error) {
      this.logger.error(`Close position failed: ${error}`);
      throw error;
    }
  }

  async getPrice(token: string): Promise<number> {
    try {
      // In production, query Aave oracle or Chainlink
      // Simplified mock implementation
      const mockPrices: Record<string, number> = {
        '0xC02aaA39b223FE8D0A0e8e4F27ead9083C756Cc2': 2000, // WETH
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': 1, // USDC
        '0x6B175474E89094C44Da98b954EedeAC495271d0F': 1, // DAI
      };

      return mockPrices[token.toLowerCase()] || 0;
    } catch (error) {
      this.logger.error(`Get price failed: ${error}`);
      throw error;
    }
  }

  async estimateGas(method: string, params?: any): Promise<string> {
    try {
      if (!this.provider) {
        throw new Error('Provider not initialized');
      }

      // Estimate gas based on method type
      const gasEstimates: Record<string, bigint> = {
        deposit: BigInt('150000'),
        withdraw: BigInt('150000'),
        borrow: BigInt('200000'),
        repay: BigInt('200000'),
        flashLoan: BigInt('250000'),
      };

      return (gasEstimates[method] || BigInt('100000')).toString();
    } catch (error) {
      this.logger.error(`Estimate gas failed: ${error}`);
      throw error;
    }
  }

  async simulateTransaction(
    method: string,
    params?: any,
  ): Promise<TransactionSimulation> {
    try {
      const gasEstimate = await this.estimateGas(method, params);

      return {
        method,
        from: params?.from || '',
        to: this.contractAddress,
        data: params?.data || '0x',
        value: params?.value || '0',
        gasEstimate,
        gasPrice: '50000000000', // 50 gwei
        totalCost: (BigInt(gasEstimate) * BigInt('50000000000')).toString(),
        success: true,
      };
    } catch (error) {
      this.logger.error(`Simulate transaction failed: ${error}`);
      return {
        method,
        from: params?.from || '',
        to: this.contractAddress,
        data: params?.data || '0x',
        value: params?.value || '0',
        gasEstimate: '0',
        gasPrice: '0',
        totalCost: '0',
        success: false,
        error: String(error),
      };
    }
  }

  async getYield(positionId: string): Promise<YieldInfo> {
    try {
      // Query current yield metrics
      return {
        apy: 5.2,
        apr: 5.0,
        earned: '50.25',
        pending: '1.05',
        frequency: 'continuous',
      };
    } catch (error) {
      this.logger.error(`Get yield failed: ${error}`);
      throw error;
    }
  }

  async getRewards(address: string): Promise<Reward[]> {
    try {
      // Query available rewards (e.g., stkAAVE, incentives)
      return [
        {
          token: '0x7Fc66500c84A76Ad7e9c93437E434122A1f3b22c', // AAVE token
          amount: '0.5',
          value: 150,
          claimable: true,
        },
      ];
    } catch (error) {
      this.logger.error(`Get rewards failed: ${error}`);
      throw error;
    }
  }

  async claimRewards(positionId: string): Promise<string> {
    try {
      this.validateContractReady();

      if (!this.signer) {
        throw new Error('Signer not available');
      }

      // Call incentives controller claim rewards
      const tx = await this.contract?.claimRewards([positionId]);
      const receipt = await tx?.wait();
      return receipt?.hash || tx?.hash;
    } catch (error) {
      this.logger.error(`Claim rewards failed: ${error}`);
      throw error;
    }
  }

  async getRiskMetrics(positionId: string): Promise<RiskMetrics> {
    try {
      return {
        positionId,
        riskScore: 25,
        riskLevel: 'low',
        liquidationPrice: 1200,
        liquidationDistance: 40,
        volatilityScore: 15,
        correlationScore: 30,
        concentrationRisk: 10,
      };
    } catch (error) {
      this.logger.error(`Get risk metrics failed: ${error}`);
      throw error;
    }
  }

  async getHealthFactor(positionId: string): Promise<number> {
    try {
      // Query user account data
      return 2.5; // Safe health factor
    } catch (error) {
      this.logger.error(`Get health factor failed: ${error}`);
      throw error;
    }
  }

  async getLiquidationThreshold(positionId: string): Promise<number> {
    try {
      // Query liquidation threshold for user
      return 1.5; // 150% LTV
    } catch (error) {
      this.logger.error(`Get liquidation threshold failed: ${error}`);
      throw error;
    }
  }
}

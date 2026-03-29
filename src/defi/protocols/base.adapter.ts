/**
 * Base Protocol Adapter - Abstract class for all protocol implementations
 */

import { Logger } from '@nestjs/common';
import { ethers, Contract, ContractInterface } from 'ethers';
import {
  IProtocol,
  DeFiPosition,
  YieldInfo,
  Reward,
  RiskMetrics,
  TransactionSimulation,
  ProtocolConfig,
} from '../interfaces/protocol.interface';

export abstract class BaseProtocolAdapter implements IProtocol {
  protected logger: Logger;
  protected contract: Contract | null = null;
  protected provider: ethers.Provider | null = null;
  protected signer: ethers.Signer | null = null;

  name: string;
  version: string;
  contractAddress: string;
  chainId: number;

  constructor(
    protected config: ProtocolConfig,
    protected rpcUrl: string,
  ) {
    this.name = config.name;
    this.contractAddress = config.contractAddress;
    this.chainId = config.chainId;
    this.version = '1.0.0';
    this.logger = new Logger(`${config.name}Adapter`);
    this.initializeProvider();
  }

  protected initializeProvider(): void {
    try {
      this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
      this.logger.log(`Provider initialized for ${this.name}`);
    } catch (error) {
      this.logger.error(`Failed to initialize provider: ${error}`);
    }
  }

  protected setSigner(signer: ethers.Signer): void {
    this.signer = signer;
    if (this.contract && this.signer) {
      this.contract = this.contract.connect(this.signer);
    }
  }

  protected async initializeContract(abi: ContractInterface): Promise<void> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }
    this.contract = new Contract(
      this.contractAddress,
      abi,
      this.provider,
    );
    this.logger.log(`Contract initialized: ${this.contractAddress}`);
  }

  async deposit(
    token: string,
    amount: string,
    params?: any,
  ): Promise<string> {
    throw new Error('Must implement deposit method');
  }

  async withdraw(
    positionId: string,
    amount: string,
    params?: any,
  ): Promise<string> {
    throw new Error('Must implement withdraw method');
  }

  async borrow(
    token: string,
    amount: string,
    params?: any,
  ): Promise<string> {
    throw new Error('Must implement borrow method');
  }

  async repay(
    positionId: string,
    amount: string,
    params?: any,
  ): Promise<string> {
    throw new Error('Must implement repay method');
  }

  async getPositions(address: string): Promise<DeFiPosition[]> {
    throw new Error('Must implement getPositions method');
  }

  async getPosition(positionId: string): Promise<DeFiPosition> {
    throw new Error('Must implement getPosition method');
  }

  async closePosition(positionId: string): Promise<string> {
    throw new Error('Must implement closePosition method');
  }

  async getPrice(token: string): Promise<number> {
    throw new Error('Must implement getPrice method');
  }

  async getPrices(tokens: string[]): Promise<Record<string, number>> {
    const prices: Record<string, number> = {};
    for (const token of tokens) {
      prices[token] = await this.getPrice(token);
    }
    return prices;
  }

  async estimateGas(method: string, params?: any): Promise<string> {
    throw new Error('Must implement estimateGas method');
  }

  async simulateTransaction(
    method: string,
    params?: any,
  ): Promise<TransactionSimulation> {
    throw new Error('Must implement simulateTransaction method');
  }

  async getYield(positionId: string): Promise<YieldInfo> {
    throw new Error('Must implement getYield method');
  }

  async getRewards(address: string): Promise<Reward[]> {
    throw new Error('Must implement getRewards method');
  }

  async claimRewards(positionId: string): Promise<string> {
    throw new Error('Must implement claimRewards method');
  }

  async getRiskMetrics(positionId: string): Promise<RiskMetrics> {
    throw new Error('Must implement getRiskMetrics method');
  }

  async getHealthFactor(positionId: string): Promise<number> {
    throw new Error('Must implement getHealthFactor method');
  }

  async getLiquidationThreshold(positionId: string): Promise<number> {
    throw new Error('Must implement getLiquidationThreshold method');
  }

  /**
   * Utility method to validate contract interaction
   */
  protected validateContractReady(): void {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }
  }

  /**
   * Utility method to get current block timestamp
   */
  protected async getBlockTimestamp(): Promise<number> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }
    const block = await this.provider.getBlock('latest');
    if (!block) {
      throw new Error('Failed to get block');
    }
    return block.timestamp;
  }

  /**
   * Utility method to format address
   */
  protected formatAddress(address: string): string {
    return ethers.getAddress(address);
  }

  /**
   * Utility method to parse amount
   */
  protected parseAmount(amount: string, decimals: number): string {
    return ethers.parseUnits(amount, decimals).toString();
  }

  /**
   * Utility method to format amount
   */
  protected formatAmount(amount: string, decimals: number): string {
    return ethers.formatUnits(amount, decimals);
  }
}

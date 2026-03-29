/**
 * Smart Contract Service
 * Handles secure smart contract interactions and approvals
 */

import { Injectable, Logger } from '@nestjs/common';
import { ethers, Contract, ContractInterface } from 'ethers';

interface ContractCall {
  target: string;
  methodName: string;
  params: any[];
  value?: string;
}

@Injectable()
export class SmartContractService {
  private readonly logger = new Logger(SmartContractService.name);
  private readonly rpcUrl = 'https://eth.llamarpc.com';
  private provider: ethers.Provider;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
  }

  /**
   * Build encoded call data for a contract method
   */
  async buildCallData(
    contractAddress: string,
    abi: ContractInterface,
    methodName: string,
    params: any[],
  ): Promise<string> {
    try {
      const contract = new Contract(
        contractAddress,
        abi,
        this.provider,
      );

      const method = contract.interface.getFunction(methodName);
      if (!method) {
        throw new Error(`Method ${methodName} not found in contract ABI`);
      }

      return contract.interface.encodeFunctionData(methodName, params);
    } catch (error) {
      this.logger.error(`Failed to build call data: ${error}`);
      throw error;
    }
  }

  /**
   * Estimate gas for contract call
   */
  async estimateGas(
    from: string,
    to: string,
    data: string,
    value?: string,
  ): Promise<string> {
    try {
      const estimation = await this.provider.estimateGas({
        from,
        to,
        data,
        value: value || '0',
      });

      return (estimation * BigInt(110)) / BigInt(100); // Add 10% buffer
    } catch (error) {
      this.logger.error(`Gas estimation failed: ${error}`);
      throw error;
    }
  }

  /**
   * Call contract method for reading data (no state change)
   */
  async callMethod(
    contractAddress: string,
    abi: ContractInterface,
    methodName: string,
    params: any[],
  ): Promise<any> {
    try {
      const contract = new Contract(
        contractAddress,
        abi,
        this.provider,
      );

      return await contract[methodName](...params);
    } catch (error) {
      this.logger.error(`Contract call failed: ${error}`);
      throw error;
    }
  }

  /**
   * Build multicall for batch operations
   */
  buildMulticall(calls: ContractCall[]): string {
    try {
      // This would use the multicall3 contract to batch multiple calls
      // Returns encoded multicall data
      const multicallAbi = [
        {
          inputs: [
            {
              components: [
                { name: 'target', type: 'address' },
                { name: 'callData', type: 'bytes' },
              ],
              name: 'calls',
              type: 'tuple[]',
            },
          ],
          name: 'aggregate3',
          outputs: [
            {
              components: [
                { name: 'success', type: 'bool' },
                { name: 'returnData', type: 'bytes' },
              ],
              name: 'returnData',
              type: 'tuple[]',
            },
          ],
          stateMutability: 'payable',
          type: 'function',
        },
      ];

      const multicallContract = new Contract(
        '0xcA11bde05977b3631167028862bE2a173976CA11', // Multicall3 address
        multicallAbi,
        this.provider,
      );

      return multicallContract.interface.encodeFunctionData(
        'aggregate3',
        [calls.map((call) => ({
          target: call.target,
          callData: call.value ? '0x' : '0x',
        }))],
      );
    } catch (error) {
      this.logger.error(`Multicall build failed: ${error}`);
      throw error;
    }
  }

  /**
   * Build approval transaction for ERC20 token
   */
  buildApprovalTx(
    tokenAddress: string,
    spenderAddress: string,
    amount: string,
  ): string {
    try {
      const erc20Abi = [
        {
          inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
          ],
          name: 'approve',
          outputs: [{ name: '', type: 'bool' }],
          stateMutability: 'nonpayable',
          type: 'function',
        },
      ];

      const contract = new Contract(
        tokenAddress,
        erc20Abi,
        this.provider,
      );

      return contract.interface.encodeFunctionData('approve', [
        spenderAddress,
        amount,
      ]);
    } catch (error) {
      this.logger.error(`Approval tx build failed: ${error}`);
      throw error;
    }
  }

  /**
   * Check allowance for ERC20 token
   */
  async checkAllowance(
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string,
  ): Promise<string> {
    try {
      const erc20Abi = [
        {
          inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
          ],
          name: 'allowance',
          outputs: [{ name: '', type: 'uint256' }],
          stateMutability: 'view',
          type: 'function',
        },
      ];

      const contract = new Contract(
        tokenAddress,
        erc20Abi,
        this.provider,
      );

      const allowance = await contract.allowance(
        ownerAddress,
        spenderAddress,
      );

      return allowance.toString();
    } catch (error) {
      this.logger.error(`Allowance check failed: ${error}`);
      throw error;
    }
  }

  /**
   * Get contract ABI from address (mock implementation)
   */
  async getContractABI(contractAddress: string): Promise<ContractInterface> {
    try {
      // In production, this would fetch from Etherscan or other sources
      // For now, return a minimal ERC20 ABI
      return [
        {
          inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
          ],
          name: 'approve',
          outputs: [{ name: '', type: 'bool' }],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        {
          inputs: [{ name: 'account', type: 'address' }],
          name: 'balanceOf',
          outputs: [{ name: '', type: 'uint256' }],
          stateMutability: 'view',
          type: 'function',
        },
      ];
    } catch (error) {
      this.logger.error(`Failed to get ABI: ${error}`);
      throw error;
    }
  }

  /**
   * Validate contract code exists at address
   */
  async validateContractExists(contractAddress: string): Promise<boolean> {
    try {
      const code = await this.provider.getCode(contractAddress);
      return code !== '0x';
    } catch (error) {
      this.logger.error(`Contract validation failed: ${error}`);
      return false;
    }
  }

  /**
   * Simulate contract call without state change
   */
  async simulateCall(
    from: string,
    to: string,
    data: string,
    value?: string,
  ): Promise<{ success: boolean; returnData?: string; error?: string }> {
    try {
      // Try to call without actually sending the transaction
      const result = await this.provider.call({
        from,
        to,
        data,
        value: value || '0',
      });

      return {
        success: true,
        returnData: result,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Decode function data
   */
  decodeFunctionData(
    abi: ContractInterface,
    data: string,
  ): { name: string; params: Record<string, any> } {
    try {
      const contract = new Contract('0x0', abi, this.provider);
      const decoded = contract.interface.parseTransaction({ data });

      if (!decoded) {
        throw new Error('Failed to decode data');
      }

      return {
        name: decoded.name,
        params: decoded.args as Record<string, any>,
      };
    } catch (error) {
      this.logger.error(`Function data decoding failed: ${error}`);
      throw error;
    }
  }

  /**
   * Calculate transaction cost
   */
  async calculateTxCost(
    gasUsed: string,
    gasPrice: string,
  ): Promise<string> {
    try {
      const cost = BigInt(gasUsed) * BigInt(gasPrice);
      return cost.toString();
    } catch (error) {
      this.logger.error(`Cost calculation failed: ${error}`);
      throw error;
    }
  }
}

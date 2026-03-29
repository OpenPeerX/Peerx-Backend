/**
 * Protocol Factory Service
 * Manages instantiation and lifecycle of all protocol adapters
 */

import { Injectable, Logger } from '@nestjs/common';
import { IProtocol, ProtocolConfig } from '../interfaces/protocol.interface';
import { BaseProtocolAdapter } from './base.adapter';
import { AaveProtocolAdapter } from './aave.adapter';
import { CompoundProtocolAdapter } from './compound.adapter';

@Injectable()
export class ProtocolFactoryService {
  private readonly logger = new Logger(ProtocolFactoryService.name);
  private protocols: Map<string, IProtocol> = new Map();

  private readonly protocolConfigs: Record<string, ProtocolConfig> = {
    aave: {
      name: 'Aave',
      enabled: true,
      contractAddress: '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9',
      chainId: 1,
      maxLeverage: 10,
      minAmount: '0.01',
      maxAmount: '10000000',
    },
    compound: {
      name: 'Compound',
      enabled: true,
      contractAddress: '0xc3d688458D6bBDf92DEef65B6d6FFC4FDE9dCB0C',
      chainId: 1,
      maxLeverage: 4,
      minAmount: '0.01',
      maxAmount: '10000000',
    },
    yearn: {
      name: 'Yearn',
      enabled: true,
      contractAddress: '0x19B3Eb3Af5d93b77a97B78Be61f0d4Cf0569052a',
      chainId: 1,
      maxLeverage: 1,
      minAmount: '0.1',
      maxAmount: '10000000',
    },
    curve: {
      name: 'Curve',
      enabled: true,
      contractAddress: '0x5f3b5DfEb7B28CDbD7FAba78963EE202a138f3B0',
      chainId: 1,
      maxLeverage: 2,
      minAmount: '100',
      maxAmount: '50000000',
    },
    uniswap: {
      name: 'Uniswap',
      enabled: true,
      contractAddress: '0x68b3465833fb72B5A828cCEEf294e3541eb3FCd4',
      chainId: 1,
      maxLeverage: 1,
      minAmount: '0.01',
      maxAmount: '10000000',
    },
    convex: {
      name: 'Convex',
      enabled: true,
      contractAddress: '0xF403C3e569E8f6F8Ce6E32eaf1EF1f4dFf2FFCF9',
      chainId: 1,
      maxLeverage: 1,
      minAmount: '100',
      maxAmount: '50000000',
    },
    lido: {
      name: 'Lido',
      enabled: true,
      contractAddress: '0xae7ab96520DE3A18E5e111B5eaAb095312D7fE84',
      chainId: 1,
      maxLeverage: 1,
      minAmount: '0.01',
      maxAmount: '10000000',
    },
  };

  constructor(private rpcUrl: string = 'https://eth.llamarpc.com') {
    this.initializeProtocols();
  }

  private initializeProtocols(): void {
    try {
      for (const [key, config] of Object.entries(this.protocolConfigs)) {
        if (!config.enabled) {
          continue;
        }

        try {
          const protocol = this.createProtocolAdapter(key, config);
          this.protocols.set(key.toLowerCase(), protocol);
          this.logger.log(`Initialized ${config.name} protocol adapter`);
        } catch (error) {
          this.logger.warn(
            `Failed to initialize ${config.name}: ${error}`,
          );
        }
      }

      this.logger.log(`Initialized ${this.protocols.size} protocol adapters`);
    } catch (error) {
      this.logger.error(`Protocol initialization failed: ${error}`);
    }
  }

  private createProtocolAdapter(
    protocol: string,
    config: ProtocolConfig,
  ): IProtocol {
    switch (protocol.toLowerCase()) {
      case 'aave':
        return new AaveProtocolAdapter(config, this.rpcUrl);
      case 'compound':
        return new CompoundProtocolAdapter(config, this.rpcUrl);
      case 'yearn':
        // TODO: Implement Yearn adapter
        return new CompoundProtocolAdapter(config, this.rpcUrl);
      case 'curve':
        // TODO: Implement Curve adapter
        return new CompoundProtocolAdapter(config, this.rpcUrl);
      case 'uniswap':
        // TODO: Implement Uniswap adapter
        return new CompoundProtocolAdapter(config, this.rpcUrl);
      case 'convex':
        // TODO: Implement Convex adapter
        return new CompoundProtocolAdapter(config, this.rpcUrl);
      case 'lido':
        // TODO: Implement Lido adapter
        return new CompoundProtocolAdapter(config, this.rpcUrl);
      default:
        throw new Error(`Unknown protocol: ${protocol}`);
    }
  }

  /**
   * Get a protocol adapter by name
   */
  getProtocol(protocol: string): IProtocol {
    const normalizedName = protocol.toLowerCase();
    const adapter = this.protocols.get(normalizedName);

    if (!adapter) {
      throw new Error(`Protocol adapter not found: ${protocol}`);
    }

    return adapter;
  }

  /**
   * Get all available protocols
   */
  getAvailableProtocols(): string[] {
    return Array.from(this.protocols.keys());
  }

  /**
   * Get protocol configuration
   */
  getProtocolConfig(protocol: string): ProtocolConfig {
    const normalizedName = protocol.toLowerCase();
    const config = this.protocolConfigs[normalizedName];

    if (!config) {
      throw new Error(`Protocol configuration not found: ${protocol}`);
    }

    return config;
  }

  /**
   * Check if protocol is enabled
   */
  isProtocolEnabled(protocol: string): boolean {
    try {
      const config = this.getProtocolConfig(protocol);
      return config.enabled;
    } catch {
      return false;
    }
  }

  /**
   * Get all protocol configurations
   */
  getAllProtocolConfigs(): Record<string, ProtocolConfig> {
    return { ...this.protocolConfigs };
  }

  /**
   * Register a custom protocol adapter
   */
  registerProtocol(
    name: string,
    adapter: IProtocol,
    config: ProtocolConfig,
  ): void {
    const normalizedName = name.toLowerCase();

    if (this.protocols.has(normalizedName)) {
      this.logger.warn(`Overwriting existing protocol: ${name}`);
    }

    this.protocols.set(normalizedName, adapter);
    this.protocolConfigs[normalizedName] = config;
    this.logger.log(`Registered custom protocol: ${name}`);
  }

  /**
   * Get protocol statistics
   */
  getProtocolStats(): Record<string, any> {
    const stats: Record<string, any> = {
      totalProtocols: this.protocols.size,
      protocols: [],
    };

    for (const [name, adapter] of this.protocols) {
      stats.protocols.push({
        name: adapter.name,
        version: adapter.version,
        contractAddress: adapter.contractAddress,
        chainId: adapter.chainId,
      });
    }

    return stats;
  }
}

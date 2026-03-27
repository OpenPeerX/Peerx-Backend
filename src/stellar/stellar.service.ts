// src/stellar/stellar.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import * as StellarSdk from 'stellar-sdk';

@Injectable()
export class StellarService implements OnModuleInit {
  private readonly logger = new Logger(StellarService.name);
  private server: StellarSdk.Horizon.Server;
  private usdcIssuer: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.initialize();
  }

  private initialize() {
    try {
      const horizonUrl = this.configService.stellar.horizonUrl;
      this.usdcIssuer = this.configService.stellar.usdcIssuer;

      if (!horizonUrl) {
        throw new Error('STELLAR_HORIZON_URL is not configured');
      }

      if (!this.usdcIssuer) {
        this.logger.error('STELLAR_USDC_ISSUER is not configured. USDC functionality will be limited.');
      } else {
        this.logger.log(`Stellar USDC Issuer configured: ${this.usdcIssuer}`);
      }

      this.server = new StellarSdk.Horizon.Server(horizonUrl);
      this.logger.log(`Stellar Horizon client initialized with URL: ${horizonUrl}`);
    } catch (error) {
      this.logger.error(`Failed to initialize Stellar service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Helper method to load an account from Stellar network
   * @param publicKey Public key of the account to load
   * @returns AccountResponse
   */
  async loadAccount(publicKey: string): Promise<StellarSdk.Horizon.AccountResponse> {
    try {
      this.logger.debug(`Loading Stellar account: ${publicKey}`);
      return await this.server.loadAccount(publicKey);
    } catch (error) {
      this.logger.error(`Failed to load Stellar account ${publicKey}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Helper method to fetch balances for a specific account
   * @param publicKey Public key of the account
   * @returns Array of balances
   */
  async getBalances(publicKey: string): Promise<any[]> {
    try {
      const account = await this.loadAccount(publicKey);
      return account.balances;
    } catch (error) {
      this.logger.error(`Failed to fetch balances for account ${publicKey}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get the configured USDC issuer address
   * @throws Error if USDC issuer is not configured
   */
  getUsdcIssuer(): string {
    if (!this.usdcIssuer) {
      throw new Error('STELLAR_USDC_ISSUER is not configured');
    }
    return this.usdcIssuer;
  }

  /**
   * Fetches the balance for the configured USDC asset
   * @param publicKey Public key of the account
   * @returns Balance string or "0" if not found
   */
  async getUsdcBalance(publicKey: string): Promise<string> {
    const balances = await this.getBalances(publicKey);
    const usdcIssuer = this.getUsdcIssuer();
    
    // Look for USDC balance that matches our configured issuer
    const usdcBalance = balances.find((b: any) => 
      b.asset_code === 'USDC' && b.asset_issuer === usdcIssuer
    );
    
    return usdcBalance ? (usdcBalance as any).balance : '0';
  }

  /**
   * Get the horizon server instance
   */
  getServer(): StellarSdk.Horizon.Server {
    return this.server;
  }
}

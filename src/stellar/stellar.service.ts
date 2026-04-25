// src/stellar/stellar.service.ts
import { Injectable, Logger, OnModuleInit, NotFoundException } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import * as StellarSdk from 'stellar-sdk';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export interface TransactionStatus {
  hash: string;
  successful: boolean;
  ledger: number;
  createdAt: string;
  sourceAccount: string;
  fee: string;
  operationCount: number;
  memo?: string;
}

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
   */
  getUsdcIssuer(): string {
    if (!this.usdcIssuer) {
      throw new Error('STELLAR_USDC_ISSUER is not configured');
    }
    return this.usdcIssuer;
  }

  /**
   * Fetches the balance for the configured USDC asset
   */
  async getUsdcBalance(publicKey: string): Promise<string> {
    const balances = await this.getBalances(publicKey);
    const usdcIssuer = this.getUsdcIssuer();
    const usdcBalance = balances.find((b: any) =>
      b.asset_code === 'USDC' && b.asset_issuer === usdcIssuer,
    );
    return usdcBalance ? (usdcBalance as any).balance : '0';
  }

  /**
   * Get the horizon server instance
   */
  getServer(): StellarSdk.Horizon.Server {
    return this.server;
  }

  /**
   * Verify a transaction on the Stellar network.
   * Returns true if the transaction exists and was successful.
   */
  async verifyTransaction(txHash: string): Promise<boolean> {
    const status = await this.getTransactionStatus(txHash);
    return status.successful;
  }

  /**
   * Get the status of a Stellar transaction by hash, with retry logic
   * for transient network failures.
   */
  async getTransactionStatus(txHash: string): Promise<TransactionStatus> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        this.logger.debug(`Fetching transaction ${txHash} (attempt ${attempt}/${MAX_RETRIES})`);
        const tx = await this.server.transactions().transaction(txHash).call();

        return {
          hash: tx.hash,
          successful: tx.successful,
          ledger: tx.ledger,
          createdAt: tx.created_at,
          sourceAccount: tx.source_account,
          fee: tx.fee_charged,
          operationCount: tx.operation_count,
          memo: tx.memo,
        };
      } catch (error) {
        lastError = error as Error;

        // 404 means the transaction doesn't exist — no point retrying
        if (error?.response?.status === 404) {
          throw new NotFoundException(`Transaction ${txHash} not found on the Stellar network`);
        }

        if (attempt < MAX_RETRIES) {
          this.logger.warn(
            `Transaction fetch attempt ${attempt} failed for ${txHash}: ${lastError.message}. Retrying in ${RETRY_DELAY_MS}ms…`,
          );
          await this.delay(RETRY_DELAY_MS * attempt);
        }
      }
    }

    this.logger.error(`All ${MAX_RETRIES} attempts failed for transaction ${txHash}: ${lastError?.message}`);
    throw lastError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

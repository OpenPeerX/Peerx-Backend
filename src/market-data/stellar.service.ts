import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as StellarSdk from 'stellar-sdk';

@Injectable()
export class StellarService implements OnModuleInit {
  private readonly logger = new Logger(StellarService.name);
  private server: StellarSdk.Horizon.Server;
  private horizonUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.horizonUrl = this.configService.get<string>('STELLAR_HORIZON_URL', 'https://horizon-testnet.stellar.org');
  }

  onModuleInit() {
    this.server = new StellarSdk.Horizon.Server(this.horizonUrl);
    this.logger.log(`Stellar service initialized with Horizon URL: ${this.horizonUrl}`);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async pollStellarNetwork() {
    this.logger.debug('Polling Stellar network for latest state...');
    
    try {
      const ledgerResponse = await this.server.ledgers()
        .order('desc')
        .limit(1)
        .call();

      if (ledgerResponse.records && ledgerResponse.records.length > 0) {
        const latestLedger = ledgerResponse.records[0];
        this.logger.log(`Latest Stellar Ledger: ${latestLedger.sequence} (Closed at: ${latestLedger.closed_at})`);
        
        // Optionally poll for transactions or other metrics
        // const txResponse = await this.server.transactions().forLedger(latestLedger.sequence).call();
        // this.logger.debug(`Found ${txResponse.records.length} transactions in ledger ${latestLedger.sequence}`);
      }
    } catch (error) {
      this.logger.error(`Failed to poll Stellar network: ${error.message}`);
      // Failures are logged but do not crash the process
    }
  }

  getHorizonUrl(): string {
    return this.horizonUrl;
  }
}

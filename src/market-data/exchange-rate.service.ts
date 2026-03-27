import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private lastUpdate: Date | null = null;
  private rates: Record<string, number> = {};

  constructor() {}

  @Cron(CronExpression.EVERY_HOUR)
  async syncExchangeRates() {
    this.logger.log('Starting scheduled exchange rate sync...');
    const startTime = Date.now();

    try {
      // Logic to fetch exchange rates
      // For now, we fetch a sample from a public API or use a mock
      const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
      
      if (response.data && response.data.rates) {
        this.rates = response.data.rates;
        this.lastUpdate = new Date();
        this.logger.log(`Successfully synced exchange rates for ${Object.keys(this.rates).length} currencies`);
      } else {
        throw new Error('Invalid response from exchange rate API');
      }

      const duration = Date.now() - startTime;
      this.logger.log(`Exchange rate sync completed in ${duration}ms`);
    } catch (error) {
      this.logger.error(`Failed to sync exchange rates: ${error.message}`);
      // Fallback: keep using old rates if available, otherwise initialized as empty
      if (this.lastUpdate) {
        this.logger.warn(`Using stale exchange rates from ${this.lastUpdate.toISOString()}`);
      } else {
        this.logger.warn('No previous exchange rates available. Service may be limited.');
      }
    }
  }

  getRates() {
    return this.rates;
  }

  getLastUpdate() {
    return this.lastUpdate;
  }
}

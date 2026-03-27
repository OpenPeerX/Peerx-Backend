// src/market-data/services/exchange-rate.service.ts
import { Injectable, Logger, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '../../config/config.service';
import axios from 'axios';

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private readonly CACHE_KEY = 'exchange_rates_usd';
  private readonly CACHE_TTL = 3600; // 1 hour in seconds

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Fetches the latest USD exchange rates.
   * Uses caching with a 1-hour TTL and fallback to stale data if the API fails.
   */
  async getUsdRates(): Promise<Record<string, number>> {
    try {
      // Check cache first
      const cachedRates = await this.cacheManager.get<Record<string, number>>(this.CACHE_KEY);
      if (cachedRates) {
        this.logger.debug('Returning cached exchange rates');
        return cachedRates;
      }

      // Get configuration
      const exchangeConfig = this.configService.exchange;
      if (!exchangeConfig || !exchangeConfig.url) {
        this.logger.error('Exchange rate URL not configured');
        throw new Error('Exchange rate configuration is missing');
      }

      // Fetch from API
      this.logger.log(`Fetching exchange rates from ${exchangeConfig.url}`);
      const response = await axios.get(exchangeConfig.url, { timeout: 5000 });

      if (!response.data || !response.data.rates) {
        throw new Error('Invalid response structure from exchange rate API');
      }

      const rates = response.data.rates;

      // Store in cache (Note: cache-manager v5+ uses milliseconds for TTL if not using a specific store)
      // Our CustomCacheModule seems to handle generic TTL in ms, but we'll follow the pattern.
      await this.cacheManager.set(this.CACHE_KEY, rates, this.CACHE_TTL * 1000);

      this.logger.log('Successfully fetched and cached exchange rates');
      return rates;
    } catch (error) {
      this.logger.error(`Error fetching exchange rates: ${error.message}`);
      
      // Fallback: Check if we have stale data in cache
      const staleRates = await this.cacheManager.get<Record<string, number>>(this.CACHE_KEY);
      if (staleRates) {
        this.logger.warn('Returning stale exchange rates as fallback after API error');
        return staleRates;
      }
      
      throw new HttpException(
        'Exchange rate service is currently unavailable and no cached data is available.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}

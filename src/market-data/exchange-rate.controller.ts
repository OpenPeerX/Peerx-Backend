// src/market-data/exchange-rate.controller.ts
import { Controller, Get, HttpException, HttpStatus, Logger, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ExchangeRateService } from './services/exchange-rate.service';
import { CacheInterceptor } from '@nestjs/cache-manager';

@ApiTags('Exchange Rate')
@Controller('exchange-rate')
export class ExchangeRateController {
  private readonly logger = new Logger(ExchangeRateController.name);

  constructor(private readonly exchangeRateService: ExchangeRateService) {}

  @Get()
  @ApiOperation({ summary: 'Get latest USD exchange rates' })
  @ApiResponse({ 
    status: 200, 
    description: 'USD rates retrieved successfully',
    schema: {
      type: 'object',
      example: {
        USD: 1.0,
        EUR: 0.92,
        JPY: 153.4,
        BTC: 0.000015
      }
    }
  })
  @ApiResponse({ status: 503, description: 'Exchange rate service unavailable' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async getExchangeRates(): Promise<Record<string, number>> {
    try {
      this.logger.debug('Received request for latest exchange rates');
      return await this.exchangeRateService.getUsdRates();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      this.logger.error('Unhandled error in getExchangeRates:', error);
      throw new HttpException(
        'Internal Server Error fetching exchange rates',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

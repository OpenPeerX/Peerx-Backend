import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { MarketDataIngestionService } from './services/market-data-ingestion.service';
import { AggregationService } from './services/aggregation.service';
import { MonitoringService } from './services/monitoring.service';

@Controller('market-data-exchange')
export class MarketDataExchangeController {
  constructor(
    private readonly ingestionService: MarketDataIngestionService,
    private readonly aggregationService: AggregationService,
    private readonly monitoringService: MonitoringService,
  ) {}

  @Get('prices')
  async getAggregatedPrices(@Query('symbol') symbol: string) {
    return { symbol, prices: [] };
  }

  @Get('prices/:symbol/exchanges')
  async getPricesByExchange(@Param('symbol') symbol: string) {
    return { symbol, exchanges: [] };
  }

  @Get('arbitrage')
  async getArbitrageOpportunities() {
    return this.aggregationService.detectArbitrage([]);
  }

  @Get('arbitrage/:symbol')
  async getArbitrageForSymbol(@Param('symbol') symbol: string) {
    return { symbol, opportunities: [] };
  }

  @Get('volumes')
  async getAggregatedVolumes() {
    return { volumes: {} };
  }

  @Get('health')
  async getExchangeHealth() {
    return this.monitoringService.getHealthStatus();
  }

  @Get('health/:exchange')
  async getSpecificExchangeHealth(@Param('exchange') exchange: string) {
    return this.monitoringService.checkExchangeHealth(exchange);
  }

  @Get('latency')
  async getLatencyMetrics() {
    return { latencies: {} };
  }

  @Get('outliers')
  async getPriceOutliers() {
    return this.aggregationService.detectOutliers([]);
  }

  @Get('best-bid-ask/:symbol')
  async getBestBidAsk(@Param('symbol') symbol: string) {
    return this.aggregationService.getBestBidAsk([]);
  }

  @Get('feeds')
  async listActiveFeeds() {
    return this.ingestionService.getActiveFeeds();
  }

  @Post('feeds/subscribe')
  async subscribeToFeed(@Body() dto: { exchange: string; symbol: string }) {
    await this.ingestionService.subscribeToFeed(dto.exchange, dto.symbol);
    return { status: 'subscribed' };
  }

  @Post('feeds/unsubscribe')
  async unsubscribeFromFeed(@Body() dto: { exchange: string; symbol: string }) {
    await this.ingestionService.unsubscribeFromFeed(dto.exchange, dto.symbol);
    return { status: 'unsubscribed' };
  }
}

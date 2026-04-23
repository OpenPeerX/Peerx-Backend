import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PriceFeed } from '../entities/price-feed.entity';
import { ExchangeHealth } from '../entities/exchange-health.entity';

@Injectable()
export class MarketDataIngestionService {
  private readonly logger = new Logger(MarketDataIngestionService.name);
  private activeFeeds: Map<string, any> = new Map();

  constructor(
    @InjectRepository(PriceFeed)
    private readonly priceFeedRepository: Repository<PriceFeed>,
    @InjectRepository(ExchangeHealth)
    private readonly exchangeHealthRepository: Repository<ExchangeHealth>,
  ) {}

  async connectExchange(exchange: string, config: any): Promise<void> {
    this.logger.log(`Connecting to exchange: ${exchange}`);
    // In production: establish WebSocket connection
    let health = await this.exchangeHealthRepository.findOne({ where: { exchange } });
    if (!health) {
      health = this.exchangeHealthRepository.create({ exchange, isConnected: true });
    } else {
      health.isConnected = true;
    }
    await this.exchangeHealthRepository.save(health);
  }

  async subscribeToFeed(exchange: string, symbol: string): Promise<void> {
    const feedKey = `${exchange}:${symbol}`;
    this.logger.log(`Subscribing to feed: ${feedKey}`);
    this.activeFeeds.set(feedKey, { exchange, symbol, active: true });
  }

  async unsubscribeFromFeed(exchange: string, symbol: string): Promise<void> {
    const feedKey = `${exchange}:${symbol}`;
    this.activeFeeds.delete(feedKey);
  }

  async savePriceFeed(data: Partial<PriceFeed>): Promise<PriceFeed> {
    const feed = this.priceFeedRepository.create(data);
    return this.priceFeedRepository.save(feed);
  }

  async updateExchangeHealth(exchange: string, health: Partial<ExchangeHealth>): Promise<void> {
    let record = await this.exchangeHealthRepository.findOne({ where: { exchange } });
    if (!record) {
      record = this.exchangeHealthRepository.create({ exchange, ...health });
    } else {
      Object.assign(record, health);
    }
    await this.exchangeHealthRepository.save(record);
  }

  getActiveFeeds(): any[] {
    return Array.from(this.activeFeeds.values());
  }
}

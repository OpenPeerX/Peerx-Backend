import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExchangeHealth } from '../entities/exchange-health.entity';

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(
    @InjectRepository(ExchangeHealth)
    private readonly exchangeHealthRepository: Repository<ExchangeHealth>,
  ) {}

  async checkExchangeHealth(exchange: string): Promise<ExchangeHealth> {
    const startTime = Date.now();
    
    // In production: ping exchange API
    const responseTime = Date.now() - startTime;

    let health = await this.exchangeHealthRepository.findOne({ where: { exchange } });
    if (!health) {
      health = this.exchangeHealthRepository.create({ exchange });
    }

    health.isConnected = true;
    health.responseTime = responseTime;
    health.lastHealthCheck = new Date();

    return this.exchangeHealthRepository.save(health);
  }

  async detectStaleData(exchange: string, thresholdMs: number = 10000): Promise<boolean> {
    const health = await this.exchangeHealthRepository.findOne({ where: { exchange } });
    if (!health || !health.lastPriceUpdate) return true;

    const age = Date.now() - health.lastPriceUpdate.getTime();
    return age > thresholdMs;
  }

  async trackLatency(exchange: string, latency: number): Promise<void> {
    let health = await this.exchangeHealthRepository.findOne({ where: { exchange } });
    if (!health) {
      health = this.exchangeHealthRepository.create({ exchange, responseTime: latency });
    } else {
      health.responseTime = latency;
    }
    await this.exchangeHealthRepository.save(health);
  }

  async getHealthStatus(exchange?: string): Promise<any> {
    if (exchange) {
      return this.exchangeHealthRepository.findOne({ where: { exchange } });
    }
    return this.exchangeHealthRepository.find();
  }

  async generateAlert(exchange: string, message: string): Promise<void> {
    this.logger.warn(`Exchange alert [${exchange}]: ${message}`);
    // In production: send to notification service
  }
}

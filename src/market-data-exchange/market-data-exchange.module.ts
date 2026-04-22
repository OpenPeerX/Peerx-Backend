import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketDataExchangeController } from './market-data-exchange.controller';
import { MarketDataIngestionService } from './services/market-data-ingestion.service';
import { AggregationService } from './services/aggregation.service';
import { MonitoringService } from './services/monitoring.service';
import { PriceFeed } from './entities/price-feed.entity';
import { ExchangeHealth } from './entities/exchange-health.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PriceFeed, ExchangeHealth])],
  controllers: [MarketDataExchangeController],
  providers: [MarketDataIngestionService, AggregationService, MonitoringService],
  exports: [MarketDataIngestionService, AggregationService, MonitoringService],
})
export class MarketDataExchangeModule {}

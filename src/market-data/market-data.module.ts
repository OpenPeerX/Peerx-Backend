import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { MarketData } from '../trading/entities/market-data.entity';
import { CustomCacheModule } from '../common/cache/cache.module';
import { CommonModule } from '../common/common.module';
import { MarketDataController } from './market-data.controller';
import { MarketDataService } from './market-data.service';
import { ExchangeRateService } from './services/exchange-rate.service';
import { ExchangeRateController } from './exchange-rate.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([MarketData]),
    CustomCacheModule,
    CommonModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [MarketDataController, ExchangeRateController],
  providers: [MarketDataService, ExchangeRateService],
  exports: [MarketDataService, ExchangeRateService],
})
export class MarketDataModule {}

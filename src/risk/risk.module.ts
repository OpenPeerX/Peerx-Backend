import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { RiskOrder } from './entities/risk-order.entity';
import { RiskProfile } from './entities/risk-profile.entity';
import { RiskService } from './services/risk.service';
import { RiskOrderService } from './services/risk-order.service';
import { RiskAlertService } from './services/risk-alert.service';
import { RiskController } from './controllers/risk.controller';
import { TradingModule } from '../trading/trading.module';
import { PortfolioService } from '../portfolio/portfolio.service';
import { OptionsService } from '../options/options.service';
import { NotificationService } from '../notification/notification.service';
import { MarketData } from '../trading/entities/market-data.entity';

// Ideally, PortfolioService, OptionsService, NotificationService would be exported from their respective modules
// If not properly exported in the project, we may need to define them as providers here or import the actual modules.
// Assuming we can just export/import modules.

import { OptionsModule } from '../options/options.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RiskOrder, RiskProfile, MarketData]),
    ScheduleModule.forRoot(), // Setup schedule module for cron jobs
    forwardRef(() => TradingModule),
    forwardRef(() => OptionsModule),
    forwardRef(() => NotificationModule),
  ],
  controllers: [RiskController],
  providers: [
    RiskService,
    RiskOrderService,
    RiskAlertService,
    // Provide PortfolioService here directly if it's missing an export in PortfolioModule
    PortfolioService,
  ],
  exports: [RiskService, RiskOrderService, RiskAlertService],
})
export class RiskModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InsuranceFund } from './entities/insurance-fund.entity';
import { InsuranceContribution } from './entities/insurance-contribution.entity';
import { InsuranceClaim } from './entities/insurance-claim.entity';
import { LiquidationEvent } from './entities/liquidation-event.entity';
import { FundHealthMetrics } from './entities/fund-health-metrics.entity';

import { InsuranceFundService } from './services/insurance-fund.service';
import { InsuranceContributionService } from './services/insurance-contribution.service';
import { InsuranceClaimService } from './services/insurance-claim.service';
import { LiquidationCoverageService } from './services/liquidation-coverage.service';
import { FundHealthMonitoringService } from './services/fund-health-monitoring.service';

import { InsuranceController } from './insurance.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InsuranceFund,
      InsuranceContribution,
      InsuranceClaim,
      LiquidationEvent,
      FundHealthMetrics,
    ]),
  ],
  controllers: [InsuranceController],
  providers: [
    InsuranceFundService,
    InsuranceContributionService,
    InsuranceClaimService,
    LiquidationCoverageService,
    FundHealthMonitoringService,
  ],
  exports: [
    InsuranceFundService,
    InsuranceContributionService,
    InsuranceClaimService,
    LiquidationCoverageService,
    FundHealthMonitoringService,
  ],
})
export class InsuranceModule {}

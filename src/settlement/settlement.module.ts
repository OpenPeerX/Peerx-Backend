import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Settlement } from './entities/settlement.entity';
import { SettlementBatch } from './entities/settlement-batch.entity';
import { FXRate } from './entities/fx-rate.entity';
import { SettlementReconciliation } from './entities/settlement-reconciliation.entity';
import { CurrencyConfig } from './entities/currency-config.entity';
import { SettlementAuditLog } from './entities/settlement-audit-log.entity';
import { SettlementService } from './services/settlement.service';
import { SettlementBatchService } from './services/settlement-batch.service';
import { FXRateService } from './services/fx-rate.service';
import { CurrencyComplianceService } from './services/currency-compliance.service';
import { SettlementReconciliationService } from './services/settlement-reconciliation.service';
import { SettlementMonitoringService } from './services/settlement-monitoring.service';
import { SettlementController } from './settlement.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Settlement,
      SettlementBatch,
      FXRate,
      SettlementReconciliation,
      CurrencyConfig,
      SettlementAuditLog,
    ]),
  ],
  controllers: [SettlementController],
  providers: [
    SettlementService,
    SettlementBatchService,
    FXRateService,
    CurrencyComplianceService,
    SettlementReconciliationService,
    SettlementMonitoringService,
  ],
  exports: [
    SettlementService,
    SettlementBatchService,
    FXRateService,
    CurrencyComplianceService,
    SettlementReconciliationService,
    SettlementMonitoringService,
  ],
})
export class SettlementModule {}

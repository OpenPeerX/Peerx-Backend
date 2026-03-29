import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { SettlementReconciliation, DiscrepancyType, ResolutionStatus } from '../entities/settlement-reconciliation.entity';
import { SettlementBatch, BatchStatus } from '../entities/settlement-batch.entity';
import { Settlement, SettlementStatus } from '../entities/settlement.entity';
import {
  InitiateReconciliationDto,
  ReconciliationDiscrepancyDto,
  ResolveDiscrepancyDto,
  ReconciliationSummaryDto,
  ReconciliationReportDto,
} from '../dto/reconciliation.dto';
import { Decimal } from 'decimal.js';

@Injectable()
export class SettlementReconciliationService {
  private readonly logger = new Logger(SettlementReconciliationService.name);

  constructor(
    @InjectRepository(SettlementReconciliation)
    private reconciliationRepository: Repository<SettlementReconciliation>,
    @InjectRepository(SettlementBatch)
    private batchRepository: Repository<SettlementBatch>,
    @InjectRepository(Settlement)
    private settlementRepository: Repository<Settlement>,
  ) {}

  /**
   * Initiate reconciliation for a batch
   */
  async initiateReconciliation(dto: InitiateReconciliationDto): Promise<ReconciliationSummaryDto> {
    const batch = await this.batchRepository.findOne({
      where: { id: dto.batchId },
      relations: ['settlements'],
    });

    if (!batch) {
      throw new NotFoundException(`Batch not found: ${dto.batchId}`);
    }

    this.logger.log(`Starting reconciliation for batch: ${batch.batchNumber}`);

    const reconciliationType = dto.reconciliationType ?? batch.reconciliationType;
    const discrepancies: SettlementReconciliation[] = [];

    // Perform reconciliation based on type
    if (reconciliationType === 'AUTOMATIC' || reconciliationType === 'HYBRID') {
      const autoDiscrepancies = await this.performAutomaticReconciliation(batch);
      discrepancies.push(...autoDiscrepancies);
    }

    // Save discrepancies
    if (discrepancies.length > 0) {
      await this.reconciliationRepository.save(discrepancies);
    }

    // Update batch reconciliation status
    const hasDiscrepancies = discrepancies.length > 0;
    batch.reconciliationStatus = hasDiscrepancies ? 'DISCREPANCIES_FOUND' : 'MATCHED';
    batch.reconciliationData = {
      expectedCount: batch.settlementCount,
      receivedCount: batch.successCount,
      discrepancies: discrepancies.map((d) => ({
        settlementId: d.settlementId ?? 'N/A',
        type: d.discrepancyType,
        details: d.description,
      })),
      resolutionNotes: '',
    };

    await this.batchRepository.save(batch);

    return this.generateReconciliationSummary(batch);
  }

  /**
   * Perform automatic reconciliation
   */
  private async performAutomaticReconciliation(
    batch: SettlementBatch,
  ): Promise<SettlementReconciliation[]> {
    const discrepancies: SettlementReconciliation[] = [];

    // 1. Check for missing settlements
    const missingCount = batch.settlementCount - batch.settlements.length;
    if (missingCount > 0) {
      for (let i = 0; i < missingCount; i++) {
        discrepancies.push(
          this.reconciliationRepository.create({
            batchId: batch.id,
            discrepancyType: DiscrepancyType.MISSING_SETTLEMENT,
            description: `Missing settlement record in batch`,
            resolutionStatus: ResolutionStatus.OPEN,
            requiresManualReview: true,
          }),
        );
      }
    }

    // 2. Check each settlement for discrepancies
    for (const settlement of batch.settlements) {
      // Status mismatch
      if (settlement.status !== SettlementStatus.COMPLETED) {
        discrepancies.push(
          this.reconciliationRepository.create({
            batchId: batch.id,
            settlementId: settlement.id,
            discrepancyType: DiscrepancyType.STATUS_MISMATCH,
            expectedStatus: SettlementStatus.COMPLETED,
            actualStatus: settlement.status,
            description: `Settlement status mismatch: expected COMPLETED, got ${settlement.status}`,
            resolutionStatus: ResolutionStatus.OPEN,
          }),
        );
        continue;
      }

      // Amount mismatch (compare with converted amount if FX was involved)
      if (settlement.executedAmount) {
        const expectedAmount = settlement.convertedAmount ?? settlement.amount;
        const tolerance = new Decimal(expectedAmount ?? 0).times(0.0001); // 0.01% tolerance
        const actualAmount = new Decimal(settlement.executedAmount);
        const expectedDecimal = new Decimal(expectedAmount ?? 0);

        if (
          actualAmount.lessThan(expectedDecimal.minus(tolerance)) ||
          actualAmount.greaterThan(expectedDecimal.plus(tolerance))
        ) {
          discrepancies.push(
            this.reconciliationRepository.create({
              batchId: batch.id,
              settlementId: settlement.id,
              discrepancyType: DiscrepancyType.AMOUNT_MISMATCH,
              expectedAmount: expectedDecimal.toNumber(),
              actualAmount: actualAmount.toNumber(),
              varianceAmount: actualAmount.minus(expectedDecimal).toNumber(),
              variancePercent: actualAmount
                .minus(expectedDecimal)
                .dividedBy(expectedDecimal)
                .times(100)
                .toNumber(),
              description: 'Settlement amount variance detected',
              resolutionStatus: ResolutionStatus.OPEN,
            }),
          );
        }
      }

      // FX rate variance
      if (settlement.fxRate && settlement.fxRate !== settlement.fxRate) {
        // Would compare with current rate
        discrepancies.push(
          this.reconciliationRepository.create({
            batchId: batch.id,
            settlementId: settlement.id,
            discrepancyType: DiscrepancyType.FX_RATE_VARIANCE,
            expectedFxRate: settlement.fxRate,
            actualFxRate: settlement.fxRate, // Would be current rate
            description: 'FX rate variance detected',
            resolutionStatus: ResolutionStatus.OPEN,
          }),
        );
      }

      // Failed settlement
      if (settlement.status === SettlementStatus.FAILED && !settlement.failureReason) {
        discrepancies.push(
          this.reconciliationRepository.create({
            batchId: batch.id,
            settlementId: settlement.id,
            discrepancyType: DiscrepancyType.FAILED_SETTLEMENT,
            description: `Settlement failed without recorded reason`,
            resolutionStatus: ResolutionStatus.OPEN,
            requiresManualReview: true,
          }),
        );
      }
    }

    this.logger.debug(`Found ${discrepancies.length} discrepancies in batch reconciliation`);
    return discrepancies;
  }

  /**
   * Record manual discrepancy
   */
  async recordDiscrepancy(
    batchId: string,
    dto: ReconciliationDiscrepancyDto,
  ): Promise<SettlementReconciliation> {
    const batch = await this.batchRepository.findOne({ where: { id: batchId } });

    if (!batch) {
      throw new NotFoundException(`Batch not found: ${batchId}`);
    }

    const discrepancy = this.reconciliationRepository.create({
      batchId,
      ...dto,
      resolutionStatus: ResolutionStatus.OPEN,
    });

    await this.reconciliationRepository.save(discrepancy);

    this.logger.log(`Discrepancy recorded for batch ${batch.batchNumber}: ${dto.discrepancyType}`);

    return discrepancy;
  }

  /**
   * Resolve discrepancy
   */
  async resolveDiscrepancy(dto: ResolveDiscrepancyDto): Promise<SettlementReconciliation> {
    const discrepancy = await this.reconciliationRepository.findOne({
      where: { id: dto.discrepancyId },
    });

    if (!discrepancy) {
      throw new NotFoundException(`Discrepancy not found: ${dto.discrepancyId}`);
    }

    discrepancy.resolutionStatus = dto.resolutionStatus;
    discrepancy.resolutionNotes = dto.resolutionNotes;
    discrepancy.resolvedAt = new Date();
    discrepancy.approvalReference = dto.approvalReference;

    // Add to audit trail
    if (!discrepancy.auditTrail) {
      discrepancy.auditTrail = [];
    }

    discrepancy.auditTrail.push({
      timestamp: new Date(),
      action: 'RESOLUTION',
      actor: 'system', // Would be actual user
      details: `Resolution status: ${dto.resolutionStatus}`,
    });

    await this.reconciliationRepository.save(discrepancy);

    this.logger.log(`Discrepancy resolved: ${discrepancy.id} - ${dto.resolutionStatus}`);

    return discrepancy;
  }

  /**
   * Generate reconciliation summary
   */
  async generateReconciliationSummary(
    batch: SettlementBatch,
  ): Promise<ReconciliationSummaryDto> {
    const discrepancies = await this.reconciliationRepository.find({
      where: { batchId: batch.id },
    });

    const discrepancyTypeCounts = new Map<DiscrepancyType, number>();
    let totalVariance = new Decimal(0);
    let hasSystematicIssues = false;

    for (const discrepancy of discrepancies) {
      // Count by type
      discrepancyTypeCounts.set(
        discrepancy.discrepancyType,
        (discrepancyTypeCounts.get(discrepancy.discrepancyType) ?? 0) + 1,
      );

      // Accumulate variance
      if (discrepancy.varianceAmount) {
        totalVariance = totalVariance.plus(discrepancy.varianceAmount);
      }

      // Check for systematic issues (same type appearing multiple times)
      if ((discrepancyTypeCounts.get(discrepancy.discrepancyType) ?? 0) > 3) {
        hasSystematicIssues = true;
      }
    }

    const matchRate = batch.settlementCount > 0 
      ? ((batch.settlementCount - discrepancies.length) / batch.settlementCount) * 100 
      : 100;

    return {
      batchId: batch.id,
      totalSettlements: batch.settlementCount,
      matchedCount: batch.settlementCount - discrepancies.length,
      discrepancyCount: discrepancies.length,
      discrepancyTypes: Array.from(discrepancyTypeCounts.entries()).map(([type, count]) => ({
        type,
        count,
      })),
      totalVarianceAmount: totalVariance.toNumber(),
      totalVariancePercent:
        batch.totalAmount > 0
          ? totalVariance.dividedBy(batch.totalAmount).times(100).toNumber()
          : 0,
      systematicIssuesDetected: hasSystematicIssues,
      requiresManualIntervention: discrepancies.some((d) => d.requiresManualReview),
      resolutionStatus: batch.reconciliationStatus,
      timestamp: new Date(),
    };
  }

  /**
   * Generate reconciliation report
   */
  async generateReconciliationReport(
    startDate: Date,
    endDate: Date,
  ): Promise<ReconciliationReportDto> {
    const batches = await this.batchRepository.find({
      where: {
        reconciledAt: Between(startDate, endDate),
      },
      relations: ['settlements'],
    });

    let totalSettlementsReconciled = 0;
    let totalDiscrepancies = 0;
    const systematicIssues = new Map<string, number>();
    let totalVariance = new Decimal(0);
    let totalResolutionTime = 0;
    let batchesRequiringIntervention = 0;

    for (const batch of batches) {
      totalSettlementsReconciled += batch.settlementCount;

      const discrepancies = await this.reconciliationRepository.find({
        where: { batchId: batch.id },
      });

      totalDiscrepancies += discrepancies.length;

      for (const discrepancy of discrepancies) {
        const issueKey = discrepancy.discrepancyType;
        systematicIssues.set(issueKey, (systematicIssues.get(issueKey) ?? 0) + 1);

        if (discrepancy.varianceAmount) {
          totalVariance = totalVariance.plus(discrepancy.varianceAmount);
        }

        if (discrepancy.requiresManualReview) {
          batchesRequiringIntervention++;
        }

        if (discrepancy.resolvedAt && batch.createdAt) {
          const time = (discrepancy.resolvedAt.getTime() - batch.createdAt.getTime()) / (1000 * 60 * 60);
          totalResolutionTime += time;
        }
      }
    }

    const matchRate = totalSettlementsReconciled > 0 
      ? ((totalSettlementsReconciled - totalDiscrepancies) / totalSettlementsReconciled) * 100 
      : 100;

    return {
      reportId: `REC-${Date.now()}`,
      generatedAt: new Date(),
      periodStart: startDate,
      periodEnd: endDate,
      totalBatchesProcessed: batches.length,
      totalSettlementsReconciled,
      matchRate,
      discrepancyRate: 100 - matchRate,
      systematiIssues: Array.from(systematicIssues.entries())
        .map(([issueType, count]) => ({
          issueType,
          occurrenceCount: count,
          severity: count > 10 ? 'CRITICAL' : count > 5 ? 'HIGH' : 'MEDIUM',
        }))
        .sort((a, b) => b.occurrenceCount - a.occurrenceCount),
      totalVarianceAmount: totalVariance.toNumber(),
      averageResolutionTime: batches.length > 0 ? totalResolutionTime / batches.length : 0,
      manualInterventionRequired: batchesRequiringIntervention > 0,
    };
  }

  /**
   * Bulk resolve discrepancies
   */
  async bulkResolveDiscrepancies(
    batchId: string,
    resolutionStatus: ResolutionStatus,
  ): Promise<number> {
    const result = await this.reconciliationRepository.update(
      {
        batchId,
        resolutionStatus: ResolutionStatus.OPEN,
      },
      {
        resolutionStatus,
        resolvedAt: new Date(),
      },
    );

    this.logger.log(
      `Bulk resolved ${result.affected} discrepancies for batch ${batchId}`,
    );

    return result.affected ?? 0;
  }

  /**
   * Get open discrepancies
   */
  async getOpenDiscrepancies(batchId?: string): Promise<SettlementReconciliation[]> {
    const query = this.reconciliationRepository.createQueryBuilder('rec');

    if (batchId) {
      query.where('rec.batchId = :batchId', { batchId });
    }

    return query
      .andWhere('rec.resolutionStatus = :status', { status: ResolutionStatus.OPEN })
      .orderBy('rec.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Check if batch is fully reconciled
   */
  async isFullyReconciled(batchId: string): Promise<boolean> {
    const openCount = await this.reconciliationRepository.count({
      where: {
        batchId,
        resolutionStatus: ResolutionStatus.OPEN,
      },
    });

    return openCount === 0;
  }
}

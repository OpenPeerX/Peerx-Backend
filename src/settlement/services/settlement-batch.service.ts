import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SettlementBatch, BatchStatus, ReconciliationStatus } from '../entities/settlement-batch.entity';
import { Settlement, SettlementStatus } from '../entities/settlement.entity';
import {
  CreateSettlementBatchDto,
  SubmitBatchDto,
  ApproveBatchDto,
  RejectBatchDto,
} from '../dto/batch.dto';
import { Decimal } from 'decimal.js';

@Injectable()
export class SettlementBatchService {
  private readonly logger = new Logger(SettlementBatchService.name);

  constructor(
    @InjectRepository(SettlementBatch)
    private batchRepository: Repository<SettlementBatch>,
    @InjectRepository(Settlement)
    private settlementRepository: Repository<Settlement>,
  ) {}

  /**
   * Create a new settlement batch
   */
  async createBatch(dto: CreateSettlementBatchDto): Promise<SettlementBatch> {
    // Validate settlements exist and are pending
    const settlements = await this.settlementRepository.find({
      where: { id: dto.settlementIds },
    });

    if (settlements.length !== dto.settlementIds.length) {
      throw new BadRequestException('One or more settlements not found');
    }

    // Verify all settlements are in pending status
    const nonPendingSettlements = settlements.filter(
      (s) =>
        s.status !== SettlementStatus.PENDING &&
        s.status !== SettlementStatus.INITIATED,
    );

    if (nonPendingSettlements.length > 0) {
      throw new BadRequestException(
        `${nonPendingSettlements.length} settlements are not in pending/initiated status`,
      );
    }

    // Verify all settlements are for the same currency
    const currencies = new Set(settlements.map((s) => s.currency));
    if (currencies.size !== 1 || !currencies.has(dto.currency)) {
      throw new BadRequestException(
        'All settlements must be for the requested currency',
      );
    }

    // Verify total amount matches
    const totalAmount = settlements
      .reduce((sum, s) => sum.plus(s.amount), new Decimal(0))
      .toNumber();

    if (parseFloat(String(dto.totalAmount)) !== totalAmount) {
      throw new BadRequestException(
        `Total amount mismatch. Expected ${totalAmount}, got ${dto.totalAmount}`,
      );
    }

    // Generate batch number
    const batchNumber = await this.generateBatchNumber(dto.currency);

    // Create batch
    const batch = this.batchRepository.create({
      batchNumber,
      status: BatchStatus.CREATED,
      currency: dto.currency,
      totalAmount: new Decimal(dto.totalAmount).toNumber(),
      settlementCount: settlement.length,
      sourceCurrency: dto.sourceCurrency,
      reconciliationStatus: ReconciliationStatus.PENDING_RECONCILIATION,
      metadata: dto.metadata,
    });

    // Save batch
    const savedBatch = await this.batchRepository.save(batch);

    // Link settlements to batch
    await this.settlementRepository.update(
      { id: dto.settlementIds },
      { batchId: savedBatch.id, status: SettlementStatus.PROCESSING },
    );

    this.logger.log(`Batch created: ${batchNumber} with ${settlements.length} settlements`);

    return savedBatch;
  }

  /**
   * Submit batch for processing
   */
  async submitBatch(dto: SubmitBatchDto): Promise<SettlementBatch> {
    const batch = await this.batchRepository.findOne({
      where: { id: dto.batchId },
      relations: ['settlements'],
    });

    if (!batch) {
      throw new NotFoundException(`Batch not found: ${dto.batchId}`);
    }

    if (batch.status !== BatchStatus.CREATED && batch.status !== BatchStatus.PENDING) {
      throw new ConflictException(
        `Batch cannot be submitted from status: ${batch.status}`,
      );
    }

    // Perform pre-submission validations
    const validations = await this.validateBatchForSubmission(batch);
    if (!validations.isValid) {
      throw new BadRequestException(`Batch validation failed: ${validations.errors.join(', ')}`);
    }

    batch.status = BatchStatus.SUBMITTED;
    batch.submittedAt = new Date();
    batch.approvalNotes = dto.approvalNotes ?? '';
    batch.metadata = dto.metadata ?? batch.metadata;

    // Update settlements to submitted
    await this.settlementRepository.update(
      { batchId: batch.id },
      { status: SettlementStatus.PROCESSING },
    );

    await this.batchRepository.save(batch);

    this.logger.log(`Batch submitted: ${batch.batchNumber}`);

    return batch;
  }

  /**
   * Approve batch for settlement
   */
  async approveBatch(
    dto: ApproveBatchDto,
    approverId: string,
  ): Promise<SettlementBatch> {
    const batch = await this.batchRepository.findOne({
      where: { id: dto.batchId },
    });

    if (!batch) {
      throw new NotFoundException(`Batch not found: ${dto.batchId}`);
    }

    if (batch.status !== BatchStatus.SUBMITTED) {
      throw new ConflictException(
        `Only submitted batches can be approved. Current status: ${batch.status}`,
      );
    }

    batch.status = BatchStatus.SUBMITTED; // Will move to processing in next step
    batch.approvedBy = approverId;
    batch.approvedAt = new Date();
    batch.approvalNotes = dto.approvalNotes;

    await this.batchRepository.save(batch);

    this.logger.log(`Batch approved: ${batch.batchNumber} by ${approverId}`);

    return batch;
  }

  /**
   * Reject batch
   */
  async rejectBatch(
    dto: RejectBatchDto,
    approverId: string,
  ): Promise<SettlementBatch> {
    const batch = await this.batchRepository.findOne({
      where: { id: dto.batchId },
      relations: ['settlements'],
    });

    if (!batch) {
      throw new NotFoundException(`Batch not found: ${dto.batchId}`);
    }

    batch.status = BatchStatus.FAILED;
    batch.errorMessage = dto.rejectionReason;
    batch.approvedBy = approverId;
    batch.approvedAt = new Date();

    // Update settlements back to pending
    await this.settlementRepository.update(
      { batchId: batch.id },
      { 
        status: SettlementStatus.PENDING,
        failureReason: `Batch rejected: ${dto.rejectionReason}`,
      },
    );

    await this.batchRepository.save(batch);

    this.logger.log(`Batch rejected: ${batch.batchNumber}`);

    return batch;
  }

  /**
   * Process batch
   */
  async processBatch(batchId: string): Promise<SettlementBatch> {
    const batch = await this.batchRepository.findOne({
      where: { id: batchId },
      relations: ['settlements'],
    });

    if (!batch) {
      throw new NotFoundException(`Batch not found: ${batchId}`);
    }

    if (batch.status !== BatchStatus.SUBMITTED) {
      throw new ConflictException(
        `Batch must be in SUBMITTED status to process`,
      );
    }

    batch.status = BatchStatus.PROCESSING;
    batch.processedAt = new Date();

    // Update settlements to converting/routing
    await this.settlementRepository.update(
      { batchId: batch.id },
      { status: SettlementStatus.CONVERTING },
    );

    await this.batchRepository.save(batch);

    this.logger.log(`Batch processing started: ${batch.batchNumber}`);

    return batch;
  }

  /**
   * Complete batch processing
   */
  async completeBatch(batchId: string): Promise<SettlementBatch> {
    const batch = await this.batchRepository.findOne({
      where: { id: batchId },
      relations: ['settlements'],
    });

    if (!batch) {
      throw new NotFoundException(`Batch not found: ${batchId}`);
    }

    // Calculate settlement statistics
    const settlements = batch.settlements;
    const successCount = settlements.filter(
      (s) => s.status === SettlementStatus.COMPLETED,
    ).length;
    const failedCount = settlements.filter(
      (s) => s.status === SettlementStatus.FAILED,
    ).length;

    batch.successCount = successCount;
    batch.failedCount = failedCount;

    // Calculate amounts
    const processedAmount = settlements
      .filter((s) => s.status === SettlementStatus.COMPLETED)
      .reduce((sum, s) => sum.plus(s.executedAmount ?? s.amount), new Decimal(0));

    const failedAmount = settlements
      .filter((s) => s.status === SettlementStatus.FAILED)
      .reduce((sum, s) => sum.plus(s.amount), new Decimal(0));

    batch.totalProcessedAmount = processedAmount.toNumber();
    batch.totalFailedAmount = failedAmount.toNumber();

    // Determine final status
    if (failedCount === 0) {
      batch.status = BatchStatus.COMPLETED;
      batch.settledAt = new Date();
    } else if (successCount > 0) {
      batch.status = BatchStatus.PARTIAL_FAILURE;
    } else {
      batch.status = BatchStatus.FAILED;
    }

    batch.reconciliationStatus = ReconciliationStatus.PENDING_RECONCILIATION;

    await this.batchRepository.save(batch);

    this.logger.log(
      `Batch completed: ${batch.batchNumber} - ${successCount} succeeded, ${failedCount} failed`,
    );

    return batch;
  }

  /**
   * Mark batch as reconciled
   */
  async markAsReconciled(batchId: string): Promise<SettlementBatch> {
    const batch = await this.batchRepository.findOne({
      where: { id: batchId },
    });

    if (!batch) {
      throw new NotFoundException(`Batch not found: ${batchId}`);
    }

    batch.reconciliationStatus = ReconciliationStatus.RESOLVED;
    batch.reconciledAt = new Date();

    await this.batchRepository.save(batch);

    this.logger.log(`Batch marked as reconciled: ${batch.batchNumber}`);

    return batch;
  }

  /**
   * Validate batch for submission
   */
  private async validateBatchForSubmission(
    batch: SettlementBatch,
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Validate settlement count
    if (batch.settlementCount === 0) {
      errors.push('Batch has no settlements');
    }

    // Validate total amount
    if (batch.totalAmount <= 0) {
      errors.push('Batch total amount must be greater than 0');
    }

    // Validate all settlements are present and valid
    if (batch.settlements && batch.settlements.length !== batch.settlementCount) {
      errors.push('Settlement count mismatch');
    }

    // Validate settlements have valid status
    if (batch.settlements) {
      const invalidSettlements = batch.settlements.filter(
        (s) =>
          s.status !== SettlementStatus.PENDING &&
          s.status !== SettlementStatus.INITIATED &&
          s.status !== SettlementStatus.PROCESSING,
      );

      if (invalidSettlements.length > 0) {
        errors.push(`${invalidSettlements.length} settlements have invalid status`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate unique batch number
   */
  private async generateBatchNumber(currency: string): Promise<string> {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const count = await this.batchRepository.count({
      where: { currency },
    });

    return `BATCH-${currency}-${today}-${String(count + 1).padStart(4, '0')}`;
  }

  /**
   * Get batch with details
   */
  async getBatchWithDetails(batchId: string): Promise<SettlementBatch> {
    const batch = await this.batchRepository.findOne({
      where: { id: batchId },
      relations: ['settlements'],
    });

    if (!batch) {
      throw new NotFoundException(`Batch not found: ${batchId}`);
    }

    return batch;
  }

  /**
   * List batches with filters
   */
  async listBatches(
    filter: {
      status?: BatchStatus;
      currency?: string;
      skip?: number;
      take?: number;
    } = {},
  ): Promise<{ batches: SettlementBatch[]; total: number }> {
    const query = this.batchRepository.createQueryBuilder('batch');

    if (filter.status) {
      query.andWhere('batch.status = :status', { status: filter.status });
    }

    if (filter.currency) {
      query.andWhere('batch.currency = :currency', { currency: filter.currency });
    }

    const total = await query.getCount();

    const batches = await query
      .orderBy('batch.createdAt', 'DESC')
      .skip(filter.skip ?? 0)
      .take(filter.take ?? 50)
      .getMany();

    return { batches, total };
  }

  /**
   * Retry failed batch
   */
  async retryBatch(batchId: string): Promise<SettlementBatch> {
    const batch = await this.batchRepository.findOne({
      where: { id: batchId },
      relations: ['settlements'],
    });

    if (!batch) {
      throw new NotFoundException(`Batch not found: ${batchId}`);
    }

    if (batch.status !== BatchStatus.FAILED && batch.status !== BatchStatus.PARTIAL_FAILURE) {
      throw new ConflictException(
        `Only failed batches can be retried. Current status: ${batch.status}`,
      );
    }

    batch.status = BatchStatus.SUBMITTED;
    batch.retryCount = (batch.retryCount ?? 0) + 1;
    batch.nextRetryAt = null;

    // Reset failed settlements to pending
    await this.settlementRepository.update(
      {
        batchId: batch.id,
        status: SettlementStatus.FAILED,
      },
      { 
        status: SettlementStatus.PENDING,
        retryCount: 0,
      },
    );

    await this.batchRepository.save(batch);

    this.logger.log(`Batch retry initiated: ${batch.batchNumber} (attempt ${batch.retryCount})`);

    return batch;
  }

  /**
   * Get batch statistics
   */
  async getBatchStatistics(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalBatches: number;
    successfulBatches: number;
    failedBatches: number;
    partialFailureBatches: number;
    totalSettlements: number;
    totalAmount: number;
    successRate: number;
  }> {
    const batches = await this.batchRepository.find({
      where: {
        createdAt: Between(startDate, endDate),
      },
      relations: ['settlements'],
    });

    const successfulBatches = batches.filter((b) => b.status === BatchStatus.COMPLETED).length;
    const failedBatches = batches.filter((b) => b.status === BatchStatus.FAILED).length;
    const partialFailureBatches = batches.filter(
      (b) => b.status === BatchStatus.PARTIAL_FAILURE,
    ).length;

    const totalSettlements = batches.reduce((sum, b) => sum + (b.settlementCount ?? 0), 0);
    const totalAmount = batches
      .reduce((sum, b) => sum.plus(b.totalAmount ?? 0), new Decimal(0))
      .toNumber();

    const successRate =
      batches.length > 0
        ? ((successfulBatches + partialFailureBatches) / batches.length) * 100
        : 0;

    return {
      totalBatches: batches.length,
      successfulBatches,
      failedBatches,
      partialFailureBatches,
      totalSettlements,
      totalAmount,
      successRate,
    };
  }
}

import { Between } from 'typeorm';

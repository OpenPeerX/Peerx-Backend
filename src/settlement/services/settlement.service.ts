import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Settlement, SettlementStatus, ComplianceStatus } from '../entities/settlement.entity';
import { SettlementBatch } from '../entities/settlement-batch.entity';
import { CurrencyConfig } from '../entities/currency-config.entity';
import { SettlementAuditLog, AuditAction } from '../entities/settlement-audit-log.entity';
import { CreateSettlementDto, UpdateSettlementDto } from '../dto/settlement.dto';
import { FXRateService } from './fx-rate.service';
import { CurrencyComplianceService } from './currency-compliance.service';
import { Decimal } from 'decimal.js';
import { v4 as uuid } from 'uuid';

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    @InjectRepository(Settlement)
    private settlementRepository: Repository<Settlement>,
    @InjectRepository(SettlementBatch)
    private batchRepository: Repository<SettlementBatch>,
    @InjectRepository(CurrencyConfig)
    private currencyConfigRepository: Repository<CurrencyConfig>,
    @InjectRepository(SettlementAuditLog)
    private auditLogRepository: Repository<SettlementAuditLog>,
    private fxRateService: FXRateService,
    private complianceService: CurrencyComplianceService,
  ) {}

  /**
   * Create a new settlement instruction
   */
  async createSettlement(dto: CreateSettlementDto): Promise<Settlement> {
    // Validate currency configuration
    const config = await this.currencyConfigRepository.findOne({
      where: { currency: dto.currency, isEnabled: true },
    });

    if (!config) {
      throw new BadRequestException(`Currency ${dto.currency} is not supported or disabled`);
    }

    // Validate amount
    const amount = new Decimal(dto.amount);
    const minAmount = new Decimal(config.minSettlementAmount);
    const maxAmount = new Decimal(config.maxSettlementAmount);

    if (amount.lessThan(minAmount) || amount.greaterThan(maxAmount)) {
      throw new BadRequestException(
        `Amount must be between ${config.minSettlementAmount} and ${config.maxSettlementAmount}`,
      );
    }

    // Perform compliance check
    const complianceCheck = await this.complianceService.performComplianceCheck({
      currency: dto.currency,
      amount: amount.toNumber(),
    });

    if (complianceCheck.flaggedForReview) {
      this.logger.warn(`Settlement flagged for compliance review: ${dto.fromAddress}`);
    }

    // Calculate FX conversion if needed
    let fxRate: number | null = null;
    let convertedAmount: number | null = null;
    let fxSource: string | null = null;

    if (config.requiresFxConversion && dto.sourceCurrency && dto.sourceCurrency !== dto.currency) {
      const conversion = await this.fxRateService.convertAmount(
        amount.toNumber(),
        dto.sourceCurrency,
        dto.currency,
      );

      fxRate = conversion.fxRate;
      convertedAmount = conversion.convertedAmount;
      fxSource = conversion.source;

      // Verify FX rate spread is acceptable
      const maxSpread = new Decimal(config.maxFxSpread);
      if (fxRate < (1 - maxSpread.dividedBy(100).toNumber())) {
        throw new BadRequestException(`FX rate spread exceeds maximum of ${config.maxFxSpread}%`);
      }
    }

    // Get routing path
    let routingPath = dto.routingPath ?? config.preferredRail;
    if (!dto.routingPath && config.requiresFxConversion) {
      const routing = await this.fxRateService.getOptimalRoutingPath(
        dto.sourceCurrency ?? dto.currency,
        dto.currency,
        amount.toNumber(),
      );
      routingPath = routing.routingPath;
    }

    // Create settlement
    const settlement = this.settlementRepository.create({
      transactionHash: uuid(),
      fromAddress: dto.fromAddress,
      toAddress: dto.toAddress,
      amount: amount.toNumber(),
      currency: dto.currency,
      status: SettlementStatus.PENDING,
      sourceCurrency: dto.sourceCurrency,
      fxRate,
      convertedAmount,
      fxSource,
      routingPath,
      complianceStatus: complianceCheck.flaggedForReview
        ? ComplianceStatus.PENDING_REVIEW
        : ComplianceStatus.APPROVED,
      complianceNotes: complianceCheck.recommendations.join('; '),
      auditTrail: [
        {
          timestamp: new Date(),
          action: 'SETTLEMENT_CREATED',
          actor: 'api',
          changes: { status: SettlementStatus.PENDING },
        },
      ],
      metadata: dto.metadata,
    });

    const savedSettlement = await this.settlementRepository.save(settlement);

    // Log to audit trail
    await this.createAuditLog({
      entityId: savedSettlement.id,
      entityType: 'SETTLEMENT',
      action: AuditAction.SETTLEMENT_CREATED,
      newState: savedSettlement,
      notes: `Settlement created: ${savedSettlement.transactionHash}`,
    });

    this.logger.log(`Settlement created: ${savedSettlement.id}`);

    return savedSettlement;
  }

  /**
   * Initiate settlement execution
   */
  async initiateSettlement(settlementId: string): Promise<Settlement> {
    const settlement = await this.settlementRepository.findOne({
      where: { id: settlementId },
    });

    if (!settlement) {
      throw new NotFoundException(`Settlement not found: ${settlementId}`);
    }

    if (settlement.status !== SettlementStatus.PENDING) {
      throw new ConflictException(
        `Settlement must be in PENDING status. Current: ${settlement.status}`,
      );
    }

    // Check compliance status
    if (settlement.complianceStatus === ComplianceStatus.REJECTED) {
      throw class.ConflictException('Settlement has been rejected by compliance');
    }

    if (settlement.complianceStatus === ComplianceStatus.PENDING_REVIEW) {
      // Wait for approval
      settlement.status = SettlementStatus.INITIATED;
    } else {
      settlement.status = SettlementStatus.PROCESSING;
    }

    await this.updateAuditTrail(settlement, AuditAction.SETTLEMENT_INITIATED);
    await this.settlementRepository.save(settlement);

    await this.createAuditLog({
      entityId: settlement.id,
      entityType: 'SETTLEMENT',
      action: AuditAction.SETTLEMENT_INITIATED,
      newState: settlement,
    });

    this.logger.log(`Settlement initiated: ${settlement.id}`);

    return settlement;
  }

  /**
   * Execute settlement conversion
   */
  async executeConversion(settlementId: string): Promise<Settlement> {
    const settlement = await this.settlementRepository.findOne({
      where: { id: settlementId },
    });

    if (!settlement) {
      throw new NotFoundException(`Settlement not found: ${settlementId}`);
    }

    if (settlement.status !== SettlementStatus.PROCESSING) {
      throw new ConflictException('Settlement must be in PROCESSING status');
    }

    settlement.status = SettlementStatus.CONVERTING;

    // If FX conversion is needed, refresh rates
    if (settlement.sourceCurrency && settlement.sourceCurrency !== settlement.currency) {
      const conversion = await this.fxRateService.convertAmount(
        settlement.amount,
        settlement.sourceCurrency,
        settlement.currency,
      );

      settlement.fxRate = conversion.fxRate;
      settlement.convertedAmount = conversion.convertedAmount;
      settlement.fxSource = conversion.source;
    } else {
      settlement.convertedAmount = settlement.amount;
      settlement.fxRate = 1;
    }

    await this.updateAuditTrail(settlement, AuditAction.SETTLEMENT_CONVERTED);
    await this.settlementRepository.save(settlement);

    await this.createAuditLog({
      entityId: settlement.id,
      entityType: 'SETTLEMENT',
      action: AuditAction.SETTLEMENT_CONVERTED,
      newState: settlement,
    });

    this.logger.log(`Settlement converted: ${settlement.id}`);

    return settlement;
  }

  /**
   * Route settlement to execution
   */
  async routeSettlement(settlementId: string): Promise<Settlement> {
    const settlement = await this.settlementRepository.findOne({
      where: { id: settlementId },
    });

    if (!settlement) {
      throw new NotFoundException(`Settlement not found: ${settlementId}`);
    }

    if (settlement.status !== SettlementStatus.CONVERTING) {
      throw new ConflictException('Settlement must be in CONVERTING status');
    }

    settlement.status = SettlementStatus.ROUTING;

    // Simulate routing logic (in real impl, would call external systems)
    settlement.settlementMethod = this.determineSettlementMethod(
      settlement.currency,
      settlement.routingPath,
    );

    await this.updateAuditTrail(settlement, AuditAction.SETTLEMENT_ROUTED);
    await this.settlementRepository.save(settlement);

    await this.createAuditLog({
      entityId: settlement.id,
      entityType: 'SETTLEMENT',
      action: AuditAction.SETTLEMENT_ROUTED,
      newState: settlement,
      notes: `Routed via: ${settlement.settlementMethod}`,
    });

    this.logger.log(`Settlement routed: ${settlement.id} via ${settlement.settlementMethod}`);

    return settlement;
  }

  /**
   * Complete settlement
   */
  async completeSettlement(
    settlementId: string,
    executedAmount?: number,
    settlementReference?: string,
  ): Promise<Settlement> {
    const settlement = await this.settlementRepository.findOne({
      where: { id: settlementId },
    });

    if (!settlement) {
      throw new NotFoundException(`Settlement not found: ${settlementId}`);
    }

    if (settlement.status !== SettlementStatus.ROUTING) {
      throw new ConflictException('Settlement must be in ROUTING status');
    }

    settlement.status = SettlementStatus.COMPLETED;
    settlement.executedAmount = executedAmount ?? settlement.convertedAmount ?? settlement.amount;
    settlement.settlementReference = settlementReference ?? uuid();
    settlement.completedAt = new Date();

    await this.updateAuditTrail(settlement, AuditAction.SETTLEMENT_COMPLETED);
    await this.settlementRepository.save(settlement);

    await this.createAuditLog({
      entityId: settlement.id,
      entityType: 'SETTLEMENT',
      action: AuditAction.SETTLEMENT_COMPLETED,
      newState: settlement,
      notes: `Executed amount: ${settlement.executedAmount}`,
    });

    this.logger.log(`Settlement completed: ${settlement.id}`);

    return settlement;
  }

  /**
   * Fail settlement
   */
  async failSettlement(
    settlementId: string,
    failureReason: string,
  ): Promise<Settlement> {
    const settlement = await this.settlementRepository.findOne({
      where: { id: settlementId },
    });

    if (!settlement) {
      throw new NotFoundException(`Settlement not found: ${settlementId}`);
    }

    if (settlement.status === SettlementStatus.FAILED ||
        settlement.status === SettlementStatus.COMPLETED) {
      throw new ConflictException(`Settlement cannot be failed from status: ${settlement.status}`);
    }

    settlement.status = SettlementStatus.FAILED;
    settlement.failureReason = failureReason;
    settlement.retryCount = (settlement.retryCount ?? 0) + 1;

    // Set next retry time (exponential backoff)
    const backoffMinutes = Math.min(Math.pow(2, settlement.retryCount), 1440); // Max 24 hours
    settlement.nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

    await this.updateAuditTrail(settlement, AuditAction.SETTLEMENT_FAILED);
    await this.settlementRepository.save(settlement);

    await this.createAuditLog({
      entityId: settlement.id,
      entityType: 'SETTLEMENT',
      action: AuditAction.SETTLEMENT_FAILED,
      newState: settlement,
      notes: failureReason,
      severity: settlement.retryCount > 3 ? 'CRITICAL' : 'ERROR',
    });

    this.logger.error(`Settlement failed: ${settlement.id} - ${failureReason}`);

    return settlement;
  }

  /**
   * Retry failed settlement
   */
  async retrySettlement(settlementId: string): Promise<Settlement> {
    const settlement = await this.settlementRepository.findOne({
      where: { id: settlementId },
    });

    if (!settlement) {
      throw new NotFoundException(`Settlement not found: ${settlementId}`);
    }

    if (settlement.status !== SettlementStatus.FAILED) {
      throw new ConflictException('Only failed settlements can be retried');
    }

    if (settlement.retryCount >= 5) {
      throw new ConflictException('Maximum retry attempts exceeded');
    }

    settlement.status = SettlementStatus.PENDING;
    settlement.failureReason = null;

    await this.updateAuditTrail(settlement, AuditAction.SETTLEMENT_RETRIED);
    await this.settlementRepository.save(settlement);

    await this.createAuditLog({
      entityId: settlement.id,
      entityType: 'SETTLEMENT',
      action: AuditAction.SETTLEMENT_RETRIED,
      newState: settlement,
      notes: `Retry attempt ${settlement.retryCount + 1}`,
    });

    this.logger.log(`Settlement retry initiated: ${settlement.id}`);

    return settlement;
  }

  /**
   * Approve settlement compliance review
   */
  async approveComplianceReview(settlementId: string): Promise<Settlement> {
    const settlement = await this.settlementRepository.findOne({
      where: { id: settlementId },
    });

    if (!settlement) {
      throw new NotFoundException(`Settlement not found: ${settlementId}`);
    }

    settlement.complianceStatus = ComplianceStatus.APPROVED;

    if (settlement.status === SettlementStatus.INITIATED) {
      settlement.status = SettlementStatus.PROCESSING;
    }

    await this.updateAuditTrail(settlement, AuditAction.COMPLIANCE_APPROVED);
    await this.settlementRepository.save(settlement);

    await this.createAuditLog({
      entityId: settlement.id,
      entityType: 'SETTLEMENT',
      action: AuditAction.COMPLIANCE_APPROVED,
      newState: settlement,
    });

    this.logger.log(`Settlement compliance approved: ${settlement.id}`);

    return settlement;
  }

  /**
   * Mark settlement as reconciled
   */
  async markAsReconciled(settlementId: string): Promise<Settlement> {
    const settlement = await this.settlementRepository.findOne({
      where: { id: settlementId },
    });

    if (!settlement) {
      throw new NotFoundException(`Settlement not found: ${settlementId}`);
    }

    settlement.status = SettlementStatus.RECONCILED;
    settlement.reconciledAt = new Date();

    await this.settlementRepository.save(settlement);

    await this.createAuditLog({
      entityId: settlement.id,
      entityType: 'SETTLEMENT',
      action: AuditAction.SETTLEMENT_COMPLETED,
      newState: settlement,
    });

    return settlement;
  }

  /**
   * Get settlement by ID
   */
  async getSettlement(settlementId: string): Promise<Settlement> {
    const settlement = await this.settlementRepository.findOne({
      where: { id: settlementId },
    });

    if (!settlement) {
      throw new NotFoundException(`Settlement not found: ${settlementId}`);
    }

    return settlement;
  }

  /**
   * List settlements with filters
   */
  async listSettlements(filter: {
    status?: SettlementStatus;
    currency?: string;
    batchId?: string;
    skip?: number;
    take?: number;
  } = {}): Promise<{ settlements: Settlement[]; total: number }> {
    const query = this.settlementRepository.createQueryBuilder('settlement');

    if (filter.status) {
      query.andWhere('settlement.status = :status', { status: filter.status });
    }

    if (filter.currency) {
      query.andWhere('settlement.currency = :currency', { currency: filter.currency });
    }

    if (filter.batchId) {
      query.andWhere('settlement.batchId = :batchId', { batchId: filter.batchId });
    }

    const total = await query.getCount();

    const settlements = await query
      .orderBy('settlement.createdAt', 'DESC')
      .skip(filter.skip ?? 0)
      .take(filter.take ?? 50)
      .getMany();

    return { settlements, total };
  }

  /**
   * Determine settlement method based on routing
   */
  private determineSettlementMethod(currency: string, routingPath?: string): string {
    if (routingPath === 'DIRECT') return 'BLOCKCHAIN';
    if (routingPath === 'BRIDGE') return 'BRIDGE';
    if (routingPath === 'STABLECOIN_SWAP') return 'STABLECOIN';

    // Default routing
    if (currency.toUpperCase() === 'USD') return 'ACH';
    if (currency.match(/^USC/)) return 'STABLECOIN';

    return 'BLOCKCHAIN';
  }

  /**
   * Update audit trail
   */
  private async updateAuditTrail(settlement: Settlement, action: AuditAction): Promise<void> {
    if (!settlement.auditTrail) {
      settlement.auditTrail = [];
    }

    settlement.auditTrail.push({
      timestamp: new Date(),
      action: action,
      actor: 'system',
      changes: { status: settlement.status },
    });
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(data: {
    entityId: string;
    entityType: string;
    action: AuditAction;
    newState?: any;
    previousState?: any;
    notes?: string;
    severity?: string;
  }): Promise<void> {
    const auditLog = this.auditLogRepository.create({
      entityId: data.entityId,
      entityType: data.entityType,
      action: data.action,
      newState: data.newState,
      previousState: data.previousState,
      notes: data.notes,
      severity: data.severity ?? 'INFO',
      status: 'SUCCESS',
      actorType: 'SYSTEM',
      timestamp: new Date(),
    });

    await this.auditLogRepository.save(auditLog);
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Settlement, SettlementStatus } from '../entities/settlement.entity';
import { SettlementBatch, BatchStatus } from '../entities/settlement-batch.entity';
import { SettlementAuditLog } from '../entities/settlement-audit-log.entity';
import { Decimal } from 'decimal.js';

@Injectable()
export class SettlementMonitoringService {
  private readonly logger = new Logger(SettlementMonitoringService.name);

  constructor(
    @InjectRepository(Settlement)
    private settlementRepository: Repository<Settlement>,
    @InjectRepository(SettlementBatch)
    private batchRepository: Repository<SettlementBatch>,
    @InjectRepository(SettlementAuditLog)
    private auditLogRepository: Repository<SettlementAuditLog>,
  ) {}

  /**
   * Get settlement metrics for a time period
   */
  async getSettlementMetrics(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalSettlements: number;
    completedSettlements: number;
    failedSettlements: number;
    pendingSettlements: number;
    avgCompletionTime: number;
    totalAmount: number;
    successRate: number;
    failureRate: number;
    averageAmount: number;
    currencyBreakdown: Record<string, { count: number; amount: number }>;
  }> {
    const settlements = await this.settlementRepository.find({
      where: {
        createdAt: Between(startDate, endDate),
      },
    });

    const completed = settlements.filter((s) => s.status === SettlementStatus.COMPLETED);
    const failed = settlements.filter((s) => s.status === SettlementStatus.FAILED);
    const pending = settlements.filter((s) => s.status === SettlementStatus.PENDING);

    // Calculate average completion time
    let totalCompletionTime = 0;
    let completedWithTime = 0;

    for (const settlement of completed) {
      if (settlement.completedAt && settlement.createdAt) {
        totalCompletionTime += settlement.completedAt.getTime() - settlement.createdAt.getTime();
        completedWithTime++;
      }
    }

    const avgCompletionTime =
      completedWithTime > 0 ? totalCompletionTime / completedWithTime / 1000 / 60 : 0; // in minutes

    // Calculate amounts
    const totalAmount = settlements
      .reduce((sum, s) => sum.plus(s.amount), new Decimal(0))
      .toNumber();

    const averageAmount = settlements.length > 0 ? totalAmount / settlements.length : 0;

    // Currency breakdown
    const currencyBreakdown: Record<string, { count: number; amount: number }> = {};
    for (const settlement of settlements) {
      if (!currencyBreakdown[settlement.currency]) {
        currencyBreakdown[settlement.currency] = { count: 0, amount: 0 };
      }
      currencyBreakdown[settlement.currency].count++;
      currencyBreakdown[settlement.currency].amount += settlement.amount;
    }

    // Calculate rates
    const successRate = settlements.length > 0 ? (completed.length / settlements.length) * 100 : 0;
    const failureRate = settlements.length > 0 ? (failed.length / settlements.length) * 100 : 0;

    return {
      totalSettlements: settlements.length,
      completedSettlements: completed.length,
      failedSettlements: failed.length,
      pendingSettlements: pending.length,
      avgCompletionTime,
      totalAmount,
      successRate,
      failureRate,
      averageAmount,
      currencyBreakdown,
    };
  }

  /**
   * Get batch metrics
   */
  async getBatchMetrics(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalBatches: number;
    completedBatches: number;
    failedBatches: number;
    partialFailureBatches: number;
    totalSettlementsInBatches: number;
    avgBatchSize: number;
    totalBatchAmount: number;
    successRate: number;
    avgProcessingTime: number;
  }> {
    const batches = await this.batchRepository.find({
      where: {
        createdAt: Between(startDate, endDate),
      },
    });

    const completed = batches.filter((b) => b.status === BatchStatus.COMPLETED);
    const failed = batches.filter((b) => b.status === BatchStatus.FAILED);
    const partialFailure = batches.filter((b) => b.status === BatchStatus.PARTIAL_FAILURE);

    // Calculate metrics
    const totalSettlements = batches.reduce((sum, b) => sum + (b.settlementCount ?? 0), 0);
    const avgBatchSize = batches.length > 0 ? totalSettlements / batches.length : 0;

    const totalBatchAmount = batches
      .reduce((sum, b) => sum.plus(b.totalAmount ?? 0), new Decimal(0))
      .toNumber();

    const successRate = batches.length > 0 ? (completed.length / batches.length) * 100 : 0;

    // Average processing time
    let totalProcessingTime = 0;
    let batchesWithTime = 0;

    for (const batch of batches) {
      if (batch.processedAt && batch.submittedAt) {
        totalProcessingTime += batch.processedAt.getTime() - batch.submittedAt.getTime();
        batchesWithTime++;
      }
    }

    const avgProcessingTime = batchesWithTime > 0 ? totalProcessingTime / batchesWithTime / 1000 / 60 : 0;

    return {
      totalBatches: batches.length,
      completedBatches: completed.length,
      failedBatches: failed.length,
      partialFailureBatches: partialFailure.length,
      totalSettlementsInBatches: totalSettlements,
      avgBatchSize,
      totalBatchAmount,
      successRate,
      avgProcessingTime,
    };
  }

  /**
   * Get real-time health status
   */
  async getHealthStatus(): Promise<{
    status: string; // HEALTHY, DEGRADED, UNHEALTHY
    timestamp: Date;
    metrics: {
      pendingSettlements: number;
      failedSettlements: number;
      staleBatches: number;
      recentErrors: number;
      topErrorTypes: string[];
    };
    recommendations: string[];
  }> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get pendingSettlements
    const pendingSettlements = await this.settlementRepository.count({
      where: { status: SettlementStatus.PENDING },
    });

    // Get failed settlements in last hour
    const failedSettlements = await this.settlementRepository.count({
      where: {
        status: SettlementStatus.FAILED,
        updatedAt: Between(oneHourAgo, now),
      },
    });

    // Get stale batches (submitted more than 24 hours ago but not completed)
    const staleBatches = await this.batchRepository.count({
      where: {
        submittedAt: Between(oneDayAgo, now),
      },
    });

    // Get recent errors
    const recentErrors = await this.auditLogRepository.count({
      where: {
        severity: 'ERROR',
        timestamp: Between(oneHourAgo, now),
      },
    });

    // Get top error types
    const errorLogs = await this.auditLogRepository.find({
      where: {
        severity: 'ERROR',
        timestamp: Between(oneHourAgo, now),
      },
      order: { timestamp: 'DESC' },
      take: 100,
    });

    const errorCounts = new Map<string, number>();
    for (const log of errorLogs) {
      errorCounts.set(log.action, (errorCounts.get(log.action) ?? 0) + 1);
    }

    const topErrorTypes = Array.from(errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map((entry) => entry[0]);

    // Determine health status
    let status = 'HEALTHY';
    const recommendations: string[] = [];

    if (failedSettlements > 10) {
      status = 'DEGRADED';
      recommendations.push('High failure rate detected - investigate root causes');
    }

    if (pendingSettlements > 1000) {
      status = 'DEGRADED';
      recommendations.push('Large pending queue - consider increasing processing capacity');
    }

    if (staleBatches > 50) {
      status = 'UNHEALTHY';
      recommendations.push('Multiple stale batches - check batch processing system');
    }

    if (recentErrors > 20) {
      if (status === 'HEALTHY') status = 'DEGRADED';
      recommendations.push('Elevated error rate - review recent changes');
    }

    if (topErrorTypes.length > 0 && recommendations.length === 0) {
      recommendations.push(`Monitor error type: ${topErrorTypes[0]}`);
    }

    return {
      status,
      timestamp: now,
      metrics: {
        pendingSettlements,
        failedSettlements,
        staleBatches,
        recentErrors,
        topErrorTypes,
      },
      recommendations,
    };
  }

  /**
   * Get circuit breaker status for a currency
   */
  async getCircuitBreakerStatus(currency: string): Promise<{
    currency: string;
    status: 'CLOSED' | 'OPEN' | 'HALF_OPEN'; // Standard circuit breaker states
    failureRate: number;
    recentFailures: number;
    threshold: number;
  }> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const recentSettlements = await this.settlementRepository.find({
      where: {
        currency,
        createdAt: Between(oneHourAgo, new Date()),
      },
    });

    const failedCount = recentSettlements.filter(
      (s) => s.status === SettlementStatus.FAILED,
    ).length;

    const failureRate = recentSettlements.length > 0 
      ? (failedCount / recentSettlements.length) * 100 
      : 0;

    // Circuit breaker logic
    let status: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
    const threshold = 15; // 15% failure rate threshold

    if (failureRate > threshold) {
      status = 'OPEN';
    } else if (failureRate > threshold * 0.5) {
      status = 'HALF_OPEN';
    }

    return {
      currency,
      status,
      failureRate,
      recentFailures: failedCount,
      threshold,
    };
  }

  /**
   * Generate daily report
   */
  async generateDailyReport(date: Date = new Date()): Promise<{
    reportDate: Date;
    summary: string;
    settlements: any;
    batches: any;
    health: any;
    anomalies: string[];
  }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const settlementMetrics = await this.getSettlementMetrics(startOfDay, endOfDay);
    const batchMetrics = await this.getBatchMetrics(startOfDay, endOfDay);
    const health = await this.getHealthStatus();

    // Detect anomalies
    const anomalies: string[] = [];

    if (settlementMetrics.failureRate > 10) {
      anomalies.push(`High failure rate: ${settlementMetrics.failureRate.toFixed(2)}%`);
    }

    if (batchMetrics.avgProcessingTime > 60) {
      // More than 60 minutes average
      anomalies.push(
        `Slow batch processing: ${batchMetrics.avgProcessingTime.toFixed(2)} minutes average`,
      );
    }

    if (settlementMetrics.avgCompletionTime > 30) {
      anomalies.push(
        `Slow settlement completion: ${settlementMetrics.avgCompletionTime.toFixed(2)} minutes average`,
      );
    }

    const summary = `
Daily Settlement Report - ${date.toISOString().split('T')[0]}
Total Settlements: ${settlementMetrics.totalSettlements}
Success Rate: ${settlementMetrics.successRate.toFixed(2)}%
Total Amount: ${settlementMetrics.totalAmount}
Total Batches: ${batchMetrics.totalBatches}
System Health: ${health.status}
`.trim();

    return {
      reportDate: new Date(startOfDay),
      summary,
      settlements: settlementMetrics,
      batches: batchMetrics,
      health,
      anomalies,
    };
  }

  /**
   * Get currency-pair performance
   */
  async getCurrencyPairPerformance(
    fromCurrency: string,
    toCurrency: string,
    days: number = 30,
  ): Promise<{
    fromCurrency: string;
    toCurrency: string;
    totalSettlements: number;
    successfulSettlements: number;
    failedSettlements: number;
    successRate: number;
    averageAmount: number;
    totalAmount: number;
    averageCompletionTime: number;
  }> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const endDate = new Date();

    const settlements = await this.settlementRepository.find({
      where: {
        currency: toCurrency,
        sourceCurrency: fromCurrency,
        createdAt: Between(startDate, endDate),
      },
    });

    const successful = settlements.filter((s) => s.status === SettlementStatus.COMPLETED);
    const failed = settlements.filter((s) => s.status === SettlementStatus.FAILED);

    let totalCompletionTime = 0;
    let settlementWithTime = 0;

    for (const settlement of successful) {
      if (settlement.completedAt && settlement.createdAt) {
        totalCompletionTime += settlement.completedAt.getTime() - settlement.createdAt.getTime();
        settlementWithTime++;
      }
    }

    const totalAmount = settlements
      .reduce((sum, s) => sum.plus(s.amount), new Decimal(0))
      .toNumber();

    return {
      fromCurrency,
      toCurrency,
      totalSettlements: settlements.length,
      successfulSettlements: successful.length,
      failedSettlements: failed.length,
      successRate: settlements.length > 0 ? (successful.length / settlements.length) * 100 : 0,
      averageAmount: settlements.length > 0 ? totalAmount / settlements.length : 0,
      totalAmount,
      averageCompletionTime:
        settlementWithTime > 0 ? totalCompletionTime / settlementWithTime / 1000 / 60 : 0,
    };
  }

  /**
   * Get alert thresholds
   */
  getAlertThresholds(): {
    failureRateThreshold: number; // Percentage
    pendingQueueThreshold: number;
    stallTimeThreshold: number; // minutes
    errorRateThreshold: number;
  } {
    return {
      failureRateThreshold: 10,
      pendingQueueThreshold: 1000,
      stallTimeThreshold: 120,
      errorRateThreshold: 5,
    };
  }

  /**
   * Export metrics to external system (e.g., Prometheus)
   */
  async exportMetrics(startDate: Date, endDate: Date): Promise<Record<string, number>> {
    const settlementMetrics = await this.getSettlementMetrics(startDate, endDate);
    const batchMetrics = await this.getBatchMetrics(startDate, endDate);

    return {
      settlement_total: settlementMetrics.totalSettlements,
      settlement_completed: settlementMetrics.completedSettlements,
      settlement_failed: settlementMetrics.failedSettlements,
      settlement_success_rate: settlementMetrics.successRate,
      settlement_avg_completion_time_minutes: settlementMetrics.avgCompletionTime,
      batch_total: batchMetrics.totalBatches,
      batch_completed: batchMetrics.completedBatches,
      batch_failed: batchMetrics.failedBatches,
      batch_success_rate: batchMetrics.successRate,
      batch_avg_processing_time_minutes: batchMetrics.avgProcessingTime,
      total_amount: settlementMetrics.totalAmount,
    };
  }
}

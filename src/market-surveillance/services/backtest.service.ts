import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { AnomalyAlert, AlertStatus, SeverityLevel } from '../entities/anomaly-alert.entity';
import { ViolationEvent } from '../entities/violation-event.entity';
import { PatternDetectionService } from './pattern-detection.service';
import { MLInferenceService } from './ml-inference.service';

/**
 * Backtest request
 */
export interface BacktestRequest {
  startDate: Date;
  endDate: Date;
  tradingPairs: string[];
  patterns?: string[]; // Specific patterns to test
  modelIds?: string[]; // Specific ML models to test
}

/**
 * Backtest result
 */
export interface BacktestResult {
  testId: string;
  status: 'COMPLETED' | 'RUNNING' | 'FAILED';
  period: { startDate: Date; endDate: Date };
  durationSeconds: number;

  // Performance metrics
  totalAlerts: number;
  confirmedViolations: number;
  falsePositives: number;

  metrics: {
    precision: number; // TP / (TP + FP)
    recall: number; // TP / (TP + FN)
    f1Score: number; // 2 * (precision * recall) / (precision + recall)
    accuracy: number; // (TP + TN) / Total
    truePositives: number;
    falsePositives: number;
    falseNegatives: number;
    trueNegatives: number;
  };

  // Pattern-specific results
  patternPerformance: Record<string, {
    detected: number;
    confirmed: number;
    falsePositive: number;
    precision: number;
    recall: number;
  }>;

  // Model comparison
  modelComparison?: Record<string, {
    alerts: number;
    truePositives: number;
    falsePositives: number;
    accuracy: number;
    f1Score: number;
  }>;

  // Time series
  alertsPerHour: Array<{ hour: Date; count: number }>;
  violationsPerHour: Array<{ hour: Date; count: number }>;

  // Recommendations
  recommendations: string[];

  // Detailed log
  logs: Array<{
    timestamp: Date;
    message: string;
    level: 'INFO' | 'WARN' | 'ERROR';
  }>;
}

/**
 * Historical pattern analysis
 */
export interface PatternAnalysis {
  patternType: string;
  frequency: number;
  averageConfidence: number;
  averageSeverity: string;
  confirmationRate: number;
  examples: string[]; // Alert IDs
}

@Injectable()
export class BacktestService {
  private readonly logger = new Logger(BacktestService.name);

  // Active backtests
  private backtests: Map<string, BacktestResult> = new Map();

  constructor(
    @InjectRepository(AnomalyAlert)
    private anomalyAlertRepository: Repository<AnomalyAlert>,
    @InjectRepository(ViolationEvent)
    private violationEventRepository: Repository<ViolationEvent>,
    private patternDetectionService: PatternDetectionService,
    private mlInferenceService: MLInferenceService,
  ) {}

  /**
   * Run backtest on historical data
   */
  async runBacktest(request: BacktestRequest): Promise<BacktestResult> {
    const testId = `backtest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    const result: BacktestResult = {
      testId,
      status: 'RUNNING',
      period: { startDate: request.startDate, endDate: request.endDate },
      durationSeconds: 0,
      totalAlerts: 0,
      confirmedViolations: 0,
      falsePositives: 0,
      metrics: {
        precision: 0,
        recall: 0,
        f1Score: 0,
        accuracy: 0,
        truePositives: 0,
        falsePositives: 0,
        falseNegatives: 0,
        trueNegatives: 0,
      },
      patternPerformance: {},
      alertsPerHour: [],
      violationsPerHour: [],
      recommendations: [],
      logs: [],
    };

    try {
      this.backtests.set(testId, result);

      this.log(result, `Backtest started: ${testId}`, 'INFO');

      // Fetch historical alerts
      const alerts = await this.anomalyAlertRepository.find({
        where: {
          createdAt: Between(request.startDate, request.endDate),
          tradingPair: request.tradingPairs.length > 0
            ? undefined
            : undefined,
        },
      });

      result.totalAlerts = alerts.length;
      this.log(result, `Found ${alerts.length} historical alerts`, 'INFO');

      // Fetch confirmed violations
      const violations = await this.violationEventRepository.find({
        where: {
          createdAt: Between(request.startDate, request.endDate),
        },
      });

      result.confirmedViolations = violations.length;

      // Calculate metrics
      this.calculateMetrics(result, alerts, violations);

      // Analyze by pattern type
      await this.analyzeByPattern(result, alerts, violations);

      // Generate time series
      await this.generateTimeSeries(result, alerts, violations);

      // Generate recommendations
      this.generateRecommendations(result);

      result.status = 'COMPLETED';
      result.durationSeconds = (Date.now() - startTime) / 1000;

      this.logger.log(`Backtest completed: ${testId} in ${result.durationSeconds}s`);

      return result;
    } catch (error) {
      result.status = 'FAILED';
      result.durationSeconds = (Date.now() - startTime) / 1000;
      this.log(result, `Backtest failed: ${error.message}`, 'ERROR');

      this.logger.error(`Backtest error: ${error.message}`);
      return result;
    }
  }

  /**
   * Analyze historical pattern effectiveness
   */
  async analyzePatterns(
    startDate: Date,
    endDate: Date,
    patterns?: string[],
  ): Promise<PatternAnalysis[]> {
    try {
      const alerts = await this.anomalyAlertRepository.find({
        where: {
          createdAt: Between(startDate, endDate),
        },
      });

      const analysis: PatternAnalysis[] = [];
      const patternMap = new Map<string, {
        alerts: AnomalyAlert[];
        violations: ViolationEvent[];
      }>();

      // Group by pattern
      alerts.forEach(alert => {
        if (!patterns || patterns.includes(alert.anomalyType)) {
          if (!patternMap.has(alert.anomalyType)) {
            patternMap.set(alert.anomalyType, { alerts: [], violations: [] });
          }
          patternMap.get(alert.anomalyType).alerts.push(alert);
        }
      });

      // Get violations for each pattern
      const violations = await this.violationEventRepository.find({
        where: {
          createdAt: Between(startDate, endDate),
        },
      });

      violations.forEach(v => {
        for (const [pattern, data] of patternMap.entries()) {
          if (v.violationType === pattern) {
            data.violations.push(v);
          }
        }
      });

      // Generate analysis
      for (const [pattern, data] of patternMap.entries()) {
        const confirmed = data.violations.length;
        const total = data.alerts.length;

        const avgConfidence =
          data.alerts.reduce((sum, a) => sum + a.confidenceScore, 0) / total;

        analysis.push({
          patternType: pattern,
          frequency: total,
          averageConfidence: avgConfidence,
          averageSeverity: this.getMostCommonSeverity(data.alerts),
          confirmationRate: total > 0 ? (confirmed / total) * 100 : 0,
          examples: data.alerts.slice(0, 5).map(a => a.id),
        });
      }

      return analysis.sort((a, b) => b.frequency - a.frequency);
    } catch (error) {
      this.logger.error(`Error analyzing patterns: ${error.message}`);
      return [];
    }
  }

  /**
   * Compare model performance
   */
  async compareModels(
    startDate: Date,
    endDate: Date,
    modelIds: string[],
  ): Promise<Record<string, any>> {
    try {
      const alerts = await this.anomalyAlertRepository.find({
        where: {
          createdAt: Between(startDate, endDate),
        },
      });

      const violations = await this.violationEventRepository.find({
        where: {
          createdAt: Between(startDate, endDate),
        },
      });

      const comparison: Record<string, any> = {};

      // Get active models
      const activeModels = await this.mlInferenceService.getActiveModels();

      for (const model of activeModels) {
        if (!modelIds || modelIds.includes(model.id)) {
          comparison[model.id] = {
            name: model.type,
            version: model.version,
            metrics: model.trainingMetrics,
            historicalAccuracy: this.estimateHistoricalAccuracy(alerts, violations),
            expectedPerformance: {
              precisionLow: Math.max(0, model.trainingMetrics.precision - 0.05),
              precisionHigh: Math.min(1, model.trainingMetrics.precision + 0.05),
              recallLow: Math.max(0, model.trainingMetrics.recall - 0.05),
              recallHigh: Math.min(1, model.trainingMetrics.recall + 0.05),
            },
          };
        }
      }

      return comparison;
    } catch (error) {
      this.logger.error(`Error comparing models: ${error.message}`);
      return {};
    }
  }

  /**
   * Simulate pattern detection on historical data
   */
  async simulateDetection(
    startDate: Date,
    endDate: Date,
    tradingPairs: string[],
  ): Promise<{
    totalSimulated: number;
    matchesHistorical: number;
    newDetections: number;
    missedDetections: number;
    falsePositives: number;
  }> {
    try {
      const historicalAlerts = await this.anomalyAlertRepository.find({
        where: {
          createdAt: Between(startDate, endDate),
          tradingPair: tradingPairs.length > 0
            ? undefined
            : undefined,
        },
      });

      // In production: would replay order book snapshots and re-detect
      // For now, compare with confirmed violations

      const violations = await this.violationEventRepository.find({
        where: {
          violationTime: Between(startDate, endDate),
        },
      });

      const matches = historicalAlerts.filter(a =>
        violations.some(v => v.anomalyAlertId === a.id),
      ).length;

      const missed = violations.length - matches;
      const falsePos = historicalAlerts.length - matches;

      return {
        totalSimulated: historicalAlerts.length,
        matchesHistorical: matches,
        newDetections: historicalAlerts.filter(a => a.status !== AlertStatus.FALSE_POSITIVE)
          .length,
        missedDetections: missed,
        falsePositives: falsePos,
      };
    } catch (error) {
      this.logger.error(`Error simulating detection: ${error.message}`);
      return {
        totalSimulated: 0,
        matchesHistorical: 0,
        newDetections: 0,
        missedDetections: 0,
        falsePositives: 0,
      };
    }
  }

  /**
   * Get backtest results
   */
  getBacktestResult(testId: string): BacktestResult | null {
    return this.backtests.get(testId) || null;
  }

  /**
   * List recent backtests
   */
  recentBacktests(limit: number = 10): BacktestResult[] {
    return Array.from(this.backtests.values())
      .sort((a, b) => new Date(b.period.startDate).getTime() - new Date(a.period.startDate).getTime())
      .slice(0, limit);
  }

  /**
   * Calculate performance metrics
   */
  private calculateMetrics(
    result: BacktestResult,
    alerts: AnomalyAlert[],
    violations: ViolationEvent[],
  ): void {
    // Simplified metric calculation
    const tp = alerts.filter(a =>
      violations.some(v => v.anomalyAlertId === a.id && a.status === AlertStatus.CONFIRMED),
    ).length;

    const fp = alerts.filter(a => a.status === AlertStatus.FALSE_POSITIVE).length;

    const fn = violations.filter(
      v => !alerts.some(a => a.id === v.anomalyAlertId),
    ).length;

    result.metrics.truePositives = tp;
    result.metrics.falsePositives = fp;
    result.metrics.falseNegatives = fn;
    result.metrics.trueNegatives = Math.max(0, alerts.length - tp - fp - fn);

    const total = tp + fp + fn + result.metrics.trueNegatives;

    result.metrics.precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    result.metrics.recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    result.metrics.f1Score =
      result.metrics.precision + result.metrics.recall > 0
        ? 2 *
          (result.metrics.precision * result.metrics.recall) /
          (result.metrics.precision + result.metrics.recall)
        : 0;
    result.metrics.accuracy = total > 0 ? (tp + result.metrics.trueNegatives) / total : 0;

    result.confirmedViolations = tp;
    result.falsePositives = fp;
  }

  /**
   * Analyze performance by pattern type
   */
  private async analyzeByPattern(
    result: BacktestResult,
    alerts: AnomalyAlert[],
    violations: ViolationEvent[],
  ): Promise<void> {
    const patternMap = new Map<string, AnomalyAlert[]>();

    alerts.forEach(a => {
      if (!patternMap.has(a.anomalyType)) {
        patternMap.set(a.anomalyType, []);
      }
      patternMap.get(a.anomalyType).push(a);
    });

    for (const [pattern, patternAlerts] of patternMap.entries()) {
      const confirmed = patternAlerts.filter(a => a.status === AlertStatus.CONFIRMED).length;
      const falsePos = patternAlerts.filter(a => a.status === AlertStatus.FALSE_POSITIVE).length;

      result.patternPerformance[pattern] = {
        detected: patternAlerts.length,
        confirmed,
        falsePositive: falsePos,
        precision: patternAlerts.length > 0 ? confirmed / patternAlerts.length : 0,
        recall:
          violations.length > 0
            ? confirmed /
              violations.filter(v => v.violationType === pattern).length
            : 0,
      };
    }
  }

  /**
   * Generate time series data
   */
  private async generateTimeSeries(
    result: BacktestResult,
    alerts: AnomalyAlert[],
    violations: ViolationEvent[],
  ): Promise<void> {
    const alertsByHour = new Map<string, number>();
    const violationsByHour = new Map<string, number>();

    alerts.forEach(a => {
      const hour = new Date(Math.floor(a.createdAt.getTime() / 3600000) * 3600000);
      const key = hour.toISOString();
      alertsByHour.set(key, (alertsByHour.get(key) || 0) + 1);
    });

    violations.forEach(v => {
      const hour = new Date(Math.floor(v.createdAt.getTime() / 3600000) * 3600000);
      const key = hour.toISOString();
      violationsByHour.set(key, (violationsByHour.get(key) || 0) + 1);
    });

    result.alertsPerHour = Array.from(alertsByHour.entries()).map(([hour, count]) => ({
      hour: new Date(hour),
      count,
    }));

    result.violationsPerHour = Array.from(violationsByHour.entries()).map(
      ([hour, count]) => ({
        hour: new Date(hour),
        count,
      }),
    );
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(result: BacktestResult): void {
    const precision = result.metrics.precision;
    const recall = result.metrics.recall;
    const f1 = result.metrics.f1Score;

    if (precision < 0.7) {
      result.recommendations.push(
        'High false positive rate detected. Consider increasing confidence thresholds.',
      );
    }

    if (recall < 0.7) {
      result.recommendations.push(
        'Low detection rate. Consider adding more aggressive detection rules.',
      );
    }

    if (f1 > 0.85) {
      result.recommendations.push('Model performance is excellent. Consider increasing deployment confidence.');
    }

    if (result.falsePositives > result.confirmedViolations * 2) {
      result.recommendations.push(
        'False positive rate is very high. Recommend tuning rule thresholds.',
      );
    }

    if (result.alerts.length === 0) {
      result.recommendations.push(
        'No alerts generated. Check if time period has sufficient data.',
      );
    }
  }

  /**
   * Get most common severity
   */
  private getMostCommonSeverity(alerts: AnomalyAlert[]): string {
    if (alerts.length === 0) return 'UNKNOWN';

    const severityMap = new Map<SeverityLevel, number>();

    alerts.forEach(a => {
      severityMap.set(a.severity, (severityMap.get(a.severity) || 0) + 1);
    });

    return Array.from(severityMap.entries()).reduce((prev, curr) =>
      curr[1] > prev[1] ? curr : prev,
    )[0];
  }

  /**
   * Estimate historical accuracy
   */
  private estimateHistoricalAccuracy(
    alerts: AnomalyAlert[],
    violations: ViolationEvent[],
  ): number {
    if (alerts.length === 0) return 0;

    const confirmed = alerts.filter(a => a.status === AlertStatus.CONFIRMED).length;
    return confirmed / alerts.length;
  }

  /**
   * Log message to backtest result
   */
  private log(result: BacktestResult, message: string, level: 'INFO' | 'WARN' | 'ERROR'): void {
    result.logs.push({
      timestamp: new Date(),
      message,
      level,
    });

    if (level === 'ERROR' || level === 'WARN') {
      this.logger.warn(message);
    } else {
      this.logger.debug(message);
    }
  }
}

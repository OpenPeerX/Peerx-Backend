import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan } from 'typeorm';
import { AnomalyAlert, AlertStatus, SeverityLevel, AnomalyType } from '../entities/anomaly-alert.entity';
import { SuspiciousActor, ThrottleLevel } from '../entities/suspicious-actor.entity';
import { PatternDetectionService, DetectionResult } from './pattern-detection.service';

/**
 * Alert record for deduplication
 */
interface AlertRecord {
  id: string;
  anomalyAlertId: string;
  actorId: string;
  tradingPair: string;
  anomalyType: string;
  severity: string;
  createdAt: Date;
  isDuplicate: boolean;
  parentAlertId?: string;
  deduplicationScore: number;
}

/**
 * Escalation event
 */
interface EscalationEvent {
  alertId: string;
  fromStatus: AlertStatus;
  toStatus: AlertStatus;
  reason: string;
  escalatedBy: string;
  timestamp: Date;
}

@Injectable()
export class AlertingService {
  private readonly logger = new Logger(AlertingService.name);

  // Recent alerts for deduplication (in-memory cache, tuned every 5 min in production)
  private recentAlerts: Map<string, AlertRecord> = new Map();
  private escalationQueue: EscalationEvent[] = [];

  // Configuration
  private readonly DEDUP_WINDOW_MS = 60000; // 1 minute
  private readonly DEDUP_THRESHOLD = 0.85; // 85% similarity
  private readonly ESCALATION_TIME_THRESHOLD_MS = 300000; // 5 minutes
  private readonly CRITICAL_ALERT_THRESHOLD = 5; // 5 alerts in window = escalate

  constructor(
    @InjectRepository(AnomalyAlert)
    private anomalyAlertRepository: Repository<AnomalyAlert>,
    @InjectRepository(SuspiciousActor)
    private suspiciousActorRepository: Repository<SuspiciousActor>,
  ) {
    this.initializeCacheCleanup();
  }

  /**
   * Create an alert manually or from pipeline
   */
  async createAlert(data: {
    tradingPair: string;
    anomalyType: AnomalyType;
    severity: SeverityLevel;
    confidenceScore: number;
    description: string;
    actorId: string;
    evidenceData: any;
  }): Promise<AnomalyAlert> {
    const alert = new AnomalyAlert();
    alert.tradingPair = data.tradingPair;
    alert.anomalyType = data.anomalyType;
    alert.severity = data.severity;
    alert.confidenceScore = data.confidenceScore;
    alert.description = data.description;
    alert.actorId = data.actorId;
    alert.evidenceData = data.evidenceData;
    alert.status = AlertStatus.DETECTED;
    alert.timestamp = new Date();

    alert.explanationLog = [
      {
        timestamp: new Date(),
        rule: 'PIPELINE_DETECTION',
        reasoning: data.description,
        metrics: data.evidenceData.mlScores || {},
        modelVersion: 'ensemble_v1',
        featureImportance: data.evidenceData.explanation?.featureImportance || {},
      },
    ];

    const saved = await this.anomalyAlertRepository.save(alert);
    await this.checkEscalationTriggers(saved);
    return saved;
  }

  /**
   * Process detection result and generate alert
   */
  async processDetection(
    detection: DetectionResult,
    tradingPair: string,
    actorId: string,
    walletAddress: string,
  ): Promise<AnomalyAlert | null> {
    try {
      // Check for duplicate
      const cacheKey = this.getCacheKey(tradingPair, actorId, detection.anomalyType);
      const duplicate = this.checkDuplicate(cacheKey, detection);

      if (duplicate) {
        this.logger.debug(`Alert deduplicated for ${cacheKey}`);
        return null; // Don't create duplicate alert
      }

      // Create new alert
      const alert = new AnomalyAlert();
      alert.tradingPair = tradingPair;
      alert.actorId = actorId;
      alert.walletAddress = walletAddress;
      alert.anomalyType = detection.anomalyType;
      alert.severity = detection.severity;
      alert.confidenceScore = detection.confidenceScore;
      alert.detectionMetrics = detection.detectionMetrics;
      alert.evidenceData = detection.evidenceData;
      alert.status = AlertStatus.DETECTED;
      alert.createdAt = new Date();

      // Store explanation
      alert.explanationLog = [
        {
          timestamp: new Date(),
          rule: detection.explanation.rule,
          reasoning: detection.explanation.reasoning,
          metrics: detection.detectionMetrics,
          modelVersion: 'v1.0',
          featureImportance: detection.explanation.featureImportance,
        },
      ];

      // Save alert
      const savedAlert = await this.anomalyAlertRepository.save(alert);

      // Add to cache
      this.recentAlerts.set(cacheKey, {
        id: savedAlert.id,
        anomalyAlertId: savedAlert.id,
        actorId,
        tradingPair,
        anomalyType: detection.anomalyType,
        severity: detection.severity,
        createdAt: savedAlert.createdAt,
        isDuplicate: false,
        deduplicationScore: 1.0,
      });

      this.logger.log(
        `Alert created: ${detection.anomalyType} for ${actorId} in ${tradingPair}`,
      );

      // Check for escalation triggers
      await this.checkEscalationTriggers(savedAlert);

      return savedAlert;
    } catch (error) {
      this.logger.error(`Error processing detection: ${error.message}`);
      return null;
    }
  }

  /**
   * Check for duplicate alerts using similarity matching
   */
  private checkDuplicate(cacheKey: string, detection: DetectionResult): boolean {
    const recent = this.recentAlerts.get(cacheKey);

    if (!recent) {
      return false; // No recent alert
    }

    // Check if within dedup window
    const timeSinceLastAlert = new Date().getTime() - recent.createdAt.getTime();

    if (timeSinceLastAlert > this.DEDUP_WINDOW_MS) {
      // Outside window, allow new alert
      this.recentAlerts.delete(cacheKey);
      return false;
    }

    // Calculate similarity score
    const similarityScore = this.calculateSimilarity(recent, detection);

    return similarityScore >= this.DEDUP_THRESHOLD;
  }

  /**
   * Calculate similarity between two alerts
   */
  private calculateSimilarity(record: AlertRecord, detection: DetectionResult): number {
    let score = 0;

    // Same anomaly type = 0.4 points
    if (record.anomalyType === detection.anomalyType) {
      score += 0.4;
    }

    // Same severity = 0.3 points
    if (record.severity === detection.severity) {
      score += 0.3;
    }

    // Confidence close (within 10%) = 0.2 points
    if (Math.abs(detection.confidenceScore - record.deduplicationScore) < 10) {
      score += 0.2;
    }

    // Previous report = 0.1 bonus
    if (record.isDuplicate) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Check escalation conditions
   */
  private async checkEscalationTriggers(alert: AnomalyAlert): Promise<void> {
    try {
      // Condition 1: CRITICAL severity auto-escalates
      if (alert.severity === SeverityLevel.CRITICAL) {
        await this.escalateAlert(
          alert.id,
          AlertStatus.ESCALATED,
          'Auto-escalation: CRITICAL severity',
          'SYSTEM',
        );
        return;
      }

      // Condition 2: Multiple alerts for same actor in short time
      const recentAlertsCount = await this.anomalyAlertRepository.count({
        where: {
          actorId: alert.actorId,
          createdAt: MoreThan(new Date(new Date().getTime() - this.ESCALATION_TIME_THRESHOLD_MS)),
          status: AlertStatus.DETECTED,
        },
      });

      if (recentAlertsCount >= this.CRITICAL_ALERT_THRESHOLD) {
        await this.escalateAlert(
          alert.id,
          AlertStatus.ESCALATED,
          `Multiple alerts (${recentAlertsCount}) for actor in last 5 minutes`,
          'SYSTEM',
        );
      }

      // Condition 3: Actor already under investigation
      const actorStatus = await this.suspiciousActorRepository.findOne({
        where: { actorId: alert.actorId },
      });

      if (actorStatus?.isUnderInvestigation) {
        await this.escalateAlert(
          alert.id,
          AlertStatus.INVESTIGATING,
          'Actor under active investigation',
          'SYSTEM',
        );
      }
    } catch (error) {
      this.logger.error(`Error checking escalation: ${error.message}`);
    }
  }

  /**
   * Escalate alert to next status
   */
  async escalateAlert(
    alertId: string,
    newStatus: AlertStatus,
    reason: string,
    escalatedBy: string,
  ): Promise<AnomalyAlert | null> {
    try {
      const alert = await this.anomalyAlertRepository.findOne({ where: { id: alertId } });

      if (!alert) {
        this.logger.warn(`Alert not found: ${alertId}`);
        return null;
      }

      // Record escalation
      const escalation: EscalationEvent = {
        alertId,
        fromStatus: alert.status,
        toStatus: newStatus,
        reason,
        escalatedBy,
        timestamp: new Date(),
      };

      this.escalationQueue.push(escalation);

      // Update alert
      const previousStatus = alert.status;
      alert.status = newStatus;
      alert.escalatedAt = new Date();
      alert.escalationReason = reason;

      // Track in explanation log
      if (!alert.explanationLog) {
        alert.explanationLog = [];
      }

      alert.explanationLog.push({
        timestamp: new Date(),
        rule: 'ESCALATION',
        reasoning: reason,
        metrics: {
          previousStatus,
          newStatus,
        },
        modelVersion: 'v1.0',
        featureImportance: {},
      });

      const updated = await this.anomalyAlertRepository.save(alert);

      this.logger.log(
        `Alert escalated from ${previousStatus} to ${newStatus}: ${reason}`,
      );

      // Dispatch notification (in production)
      await this.dispatchNotification(updated, previousStatus);

      return updated;
    } catch (error) {
      this.logger.error(`Error escalating alert: ${error.message}`);
      return null;
    }
  }

  /**
   * Investigate alert (set status to INVESTIGATING)
   */
  async investigateAlert(
    alertId: string,
    investigatorId: string,
    notes: string,
  ): Promise<AnomalyAlert | null> {
    try {
      const alert = await this.anomalyAlertRepository.findOne({ where: { id: alertId } });

      if (!alert) {
        return null;
      }

      alert.status = AlertStatus.INVESTIGATING;
      alert.investigatedBy = investigatorId;
      alert.investigatedAt = new Date();
      alert.investigationNotes = notes;

      const updated = await this.anomalyAlertRepository.save(alert);

      this.logger.log(`Alert investigation started: ${alertId}`);

      return updated;
    } catch (error) {
      this.logger.error(`Error investigating alert: ${error.message}`);
      return null;
    }
  }

  /**
   * Confirm violation (set status to CONFIRMED)
   */
  async confirmViolation(
    alertId: string,
    investigatorId: string,
    findings: string,
  ): Promise<AnomalyAlert | null> {
    try {
      const alert = await this.anomalyAlertRepository.findOne({ where: { id: alertId } });

      if (!alert) {
        return null;
      }

      alert.status = AlertStatus.CONFIRMED;
      alert.resolutionNotes = findings;

      // Update suspicious actor record
      let actor = await this.suspiciousActorRepository.findOne({
        where: { actorId: alert.actorId },
      });

      if (!actor) {
        actor = new SuspiciousActor();
        actor.actorId = alert.actorId;
        actor.walletAddress = alert.walletAddress;
      }

      actor.totalViolations++;
      actor.lastViolationTime = new Date();

      // Increment specific violation count
      switch (alert.anomalyType) {
        case 'SPOOFING':
          actor.spoofingCount++;
          break;
        case 'LAYERING':
          actor.layeringCount++;
          break;
        case 'WASH_TRADING':
          actor.washTradingCount++;
          break;
        default:
          actor.otherViolationCount++;
      }

      // Update risk score
      actor.riskScore = Math.min(100, actor.riskScore + 15);
      actor.riskLevel = this.calculateRiskLevel(actor.riskScore);

      await this.suspiciousActorRepository.save(actor);
      const updated = await this.anomalyAlertRepository.save(alert);

      this.logger.log(`Alert confirmed: ${alert.anomalyType} for ${alert.actorId}`);

      return updated;
    } catch (error) {
      this.logger.error(`Error confirming violation: ${error.message}`);
      return null;
    }
  }

  /**
   * Mark alert as false positive and learn from error
   */
  async markFalsePositive(
    alertId: string,
    reason: string,
  ): Promise<AnomalyAlert | null> {
    try {
      const alert = await this.anomalyAlertRepository.findOne({ where: { id: alertId } });

      if (!alert) {
        return null;
      }

      alert.status = AlertStatus.FALSE_POSITIVE;
      alert.resolutionNotes = reason;

      const updated = await this.anomalyAlertRepository.save(alert);

      // Log for model retraining (reduce confidence on this pattern)
      this.logger.log(
        `False positive marked: ${alert.anomalyType}, will reduce weight in future training`,
      );

      return updated;
    } catch (error) {
      this.logger.error(`Error marking false positive: ${error.message}`);
      return null;
    }
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string, resolution: string): Promise<AnomalyAlert | null> {
    try {
      const alert = await this.anomalyAlertRepository.findOne({ where: { id: alertId } });

      if (!alert) {
        return null;
      }

      alert.status = AlertStatus.RESOLVED;
      alert.resolutionNotes = resolution;
      alert.resolvedAt = new Date();

      const updated = await this.anomalyAlertRepository.save(alert);

      this.logger.log(`Alert resolved: ${alertId}`);

      return updated;
    } catch (error) {
      this.logger.error(`Error resolving alert: ${error.message}`);
      return null;
    }
  }

  /**
   * Get alerts for dashboard/review
   */
  async getAlerts(filters?: {
    status?: AlertStatus;
    severity?: SeverityLevel;
    actorId?: string;
    tradingPair?: string;
    limit?: number;
    offset?: number;
  }): Promise<AnomalyAlert[]> {
    try {
      let query = this.anomalyAlertRepository.createQueryBuilder('alert');

      if (filters?.status) {
        query = query.where('alert.status = :status', { status: filters.status });
      }

      if (filters?.severity) {
        query = query.andWhere('alert.severity = :severity', { severity: filters.severity });
      }

      if (filters?.actorId) {
        query = query.andWhere('alert.actorId = :actorId', { actorId: filters.actorId });
      }

      if (filters?.tradingPair) {
        query = query.andWhere('alert.tradingPair = :tradingPair', {
          tradingPair: filters.tradingPair,
        });
      }

      query = query.orderBy('alert.createdAt', 'DESC');

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      if (filters?.offset) {
        query = query.offset(filters.offset);
      }

      return await query.getMany();
    } catch (error) {
      this.logger.error(`Error fetching alerts: ${error.message}`);
      return [];
    }
  }

  /**
   * Get alert statistics
   */
  async getAlertStats(): Promise<Record<string, any>> {
    try {
      const total = await this.anomalyAlertRepository.count();
      const detected = await this.anomalyAlertRepository.count({
        where: { status: AlertStatus.DETECTED },
      });
      const investigating = await this.anomalyAlertRepository.count({
        where: { status: AlertStatus.INVESTIGATING },
      });
      const confirmed = await this.anomalyAlertRepository.count({
        where: { status: AlertStatus.CONFIRMED },
      });
      const falsePositives = await this.anomalyAlertRepository.count({
        where: { status: AlertStatus.FALSE_POSITIVE },
      });

      const bySeverity = {
        critical: await this.anomalyAlertRepository.count({
          where: { severity: SeverityLevel.CRITICAL },
        }),
        high: await this.anomalyAlertRepository.count({
          where: { severity: SeverityLevel.HIGH },
        }),
        medium: await this.anomalyAlertRepository.count({
          where: { severity: SeverityLevel.MEDIUM },
        }),
        low: await this.anomalyAlertRepository.count({
          where: { severity: SeverityLevel.LOW },
        }),
      };

      return {
        total,
        byStatus: {
          detected,
          investigating,
          confirmed,
          falsePositives,
          resolved: await this.anomalyAlertRepository.count({
            where: { status: AlertStatus.RESOLVED },
          }),
        },
        bySeverity,
        falsePositiveRate: total > 0 ? (falsePositives / total) * 100 : 0,
        confirmationRate: total > 0 ? (confirmed / total) * 100 : 0,
      };
    } catch (error) {
      this.logger.error(`Error fetching alert stats: ${error.message}`);
      return {};
    }
  }

  /**
   * Dispatch notification (stub for production integration)
   */
  private async dispatchNotification(
    alert: AnomalyAlert,
    previousStatus: AlertStatus,
  ): Promise<void> {
    // In production: send to Slack, PagerDuty, email, etc.
    this.logger.log(
      `[NOTIFICATION] Alert ${alert.id} escalated from ${previousStatus} to ${alert.status}`,
    );
  }

  /**
   * Calculate risk level from score
   */
  private calculateRiskLevel(score: number): string {
    if (score >= 80) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Generate cache key for deduplication
   */
  private getCacheKey(tradingPair: string, actorId: string, anomalyType: string): string {
    return `${tradingPair}:${actorId}:${anomalyType}`;
  }

  /**
   * Initialize cache cleanup interval
   */
  private initializeCacheCleanup(): void {
    setInterval(() => {
      const now = new Date().getTime();
      let cleaned = 0;

      for (const [key, record] of this.recentAlerts.entries()) {
        if (now - record.createdAt.getTime() > this.DEDUP_WINDOW_MS * 5) {
          this.recentAlerts.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        this.logger.debug(`Cleaned ${cleaned} expired cache entries`);
      }

      // Trim escalation queue
      this.escalationQueue = this.escalationQueue.slice(-1000); // Keep last 1000
    }, 300000); // Every 5 minutes
  }
}

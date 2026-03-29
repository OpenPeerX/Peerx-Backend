import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { SuspiciousActor, ThrottleLevel } from '../entities/suspicious-actor.entity';
import { AnomalyAlert, SeverityLevel } from '../entities/anomaly-alert.entity';

/**
 * Rate limit configuration per throttle level
 */
export interface RateLimitConfig {
  level: ThrottleLevel;
  percentReduction: number; // e.g., 25 for 25% reduction
  maxOrdersPerSecond: number;
  maxOrdersPerDay: number;
  suspensionPeriodMinutes: number; // 0 = no suspension
  description: string;
}

/**
 * Throttle request/response
 */
export interface ThrottleRequest {
  actorId: string;
  tradingPair: string;
  orderSize: number;
  orderType: 'BUY' | 'SELL';
}

export interface ThrottleResponse {
  isAllowed: boolean;
  throttleLevel: ThrottleLevel;
  throttlePercent: number;
  reason?: string;
  remainingOrders: number;
  resetTime?: Date;
}

/**
 * Appeal request/response
 */
export interface AppealRequest {
  actorId: string;
  reason: string;
  submittedBy: string;
}

export interface AppealResponse {
  appealId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedAt: Date;
  decidedAt?: Date;
  decisionReason?: string;
}

@Injectable()
export class ActorThrottlingService {
  private readonly logger = new Logger(ActorThrottlingService.name);

  // Rate limit configurations
  private readonly rateLimitConfigs: Map<ThrottleLevel, RateLimitConfig> = new Map();

  // Order tracking (in production, use Redis for distributed systems)
  private orderTracking: Map<string, Array<{ timestamp: Date; orderSize: number }>> =
    new Map();

  // Appeal tracking
  private appeals: Map<string, AppealResponse> = new Map();

  // Auto-suspension threshold: N violations in M hours triggers auto-suspension
  private readonly AUTO_SUSPEND_THRESHOLD = 10; // violations
  private readonly AUTO_SUSPEND_PERIOD_HOURS = 1;

  constructor(
    @InjectRepository(SuspiciousActor)
    private suspiciousActorRepository: Repository<SuspiciousActor>,
    @InjectRepository(AnomalyAlert)
    private anomalyAlertRepository: Repository<AnomalyAlert>,
  ) {
    this.initializeRateLimits();
  }

  /**
   * Initialize rate limit configurations
   */
  private initializeRateLimits(): void {
    const configs: RateLimitConfig[] = [
      {
        level: ThrottleLevel.NONE,
        percentReduction: 0,
        maxOrdersPerSecond: 1000,
        maxOrdersPerDay: 1000000,
        suspensionPeriodMinutes: 0,
        description: 'No restrictions',
      },
      {
        level: ThrottleLevel.WARNING,
        percentReduction: 0,
        maxOrdersPerSecond: 1000,
        maxOrdersPerDay: 1000000,
        suspensionPeriodMinutes: 0,
        description: 'Warning issued, no restrictions yet',
      },
      {
        level: ThrottleLevel.LIGHT,
        percentReduction: 25,
        maxOrdersPerSecond: 250,
        maxOrdersPerDay: 750000,
        suspensionPeriodMinutes: 0,
        description: '25% reduction in order volume',
      },
      {
        level: ThrottleLevel.MODERATE,
        percentReduction: 50,
        maxOrdersPerSecond: 100,
        maxOrdersPerDay: 500000,
        suspensionPeriodMinutes: 0,
        description: '50% reduction in order volume',
      },
      {
        level: ThrottleLevel.SEVERE,
        percentReduction: 75,
        maxOrdersPerSecond: 25,
        maxOrdersPerDay: 250000,
        suspensionPeriodMinutes: 0,
        description: '75% reduction in order volume',
      },
      {
        level: ThrottleLevel.SUSPENDED,
        percentReduction: 100,
        maxOrdersPerSecond: 0,
        maxOrdersPerDay: 0,
        suspensionPeriodMinutes: 1440, // 24 hours
        description: 'Complete trading suspension',
      },
    ];

    configs.forEach(config => {
      this.rateLimitConfigs.set(config.level, config);
    });

    this.logger.log(`Initialized ${configs.length} rate limit configurations`);
  }

  /**
   * Check if order should be throttled
   */
  async checkThrottle(request: ThrottleRequest): Promise<ThrottleResponse> {
    try {
      const actor = await this.suspiciousActorRepository.findOne({
        where: { actorId: request.actorId },
      });

      // Not in system = no throttle
      if (!actor) {
        return {
          isAllowed: true,
          throttleLevel: ThrottleLevel.NONE,
          throttlePercent: 0,
          remainingOrders: 1000,
        };
      }

      // Check if suspension period has expired
      if (actor.throttleLevel === ThrottleLevel.SUSPENDED && actor.throttledUntil) {
        if (new Date() > actor.throttledUntil) {
          // Auto-unsuspend
          actor.throttleLevel = ThrottleLevel.MODERATE;
          actor.throttledUntil = null;
          await this.suspiciousActorRepository.save(actor);
          this.logger.log(`Auto-unsuspended actor ${request.actorId} after timeout`);
        }
      }

      const config = this.rateLimitConfigs.get(actor.throttleLevel);
      if (!config) {
        return {
          isAllowed: true,
          throttleLevel: ThrottleLevel.NONE,
          throttlePercent: 0,
          remainingOrders: 1000,
        };
      }

      // Check orders per second
      const trackingKey = `${request.actorId}:rate`;
      const recentOrders = this.getRecentOrders(trackingKey, 1000); // Last 1 second

      if (recentOrders.length >= config.maxOrdersPerSecond) {
        return {
          isAllowed: false,
          throttleLevel: actor.throttleLevel,
          throttlePercent: config.percentReduction,
          reason: `Rate limit exceeded: ${recentOrders.length}/${config.maxOrdersPerSecond} orders/sec`,
          remainingOrders: Math.max(0, config.maxOrdersPerSecond - recentOrders.length),
          resetTime: new Date(Date.now() + 1000), // Reset in 1 sec
        };
      }

      // Calculate order size reduction
      const adjustedOrderSize = request.orderSize * (1 - config.percentReduction / 100);

      // Record order
      this.recordOrder(trackingKey, request.orderSize);

      return {
        isAllowed: true,
        throttleLevel: actor.throttleLevel,
        throttlePercent: config.percentReduction,
        remainingOrders: Math.max(0, config.maxOrdersPerSecond - recentOrders.length - 1),
      };
    } catch (error) {
      this.logger.error(`Error checking throttle: ${error.message}`);
      // On error, allow order (fail-open for UX)
      return {
        isAllowed: true,
        throttleLevel: ThrottleLevel.WARNING,
        throttlePercent: 0,
        remainingOrders: 1000,
      };
    }
  }

  /**
   * Apply throttle to actor
   */
  async applyThrottle(
    actorId: string,
    level: ThrottleLevel,
    reason: string,
    durationMinutes?: number,
  ): Promise<SuspiciousActor> {
    try {
      let actor = await this.suspiciousActorRepository.findOne({
        where: { actorId },
      });

      if (!actor) {
        actor = new SuspiciousActor();
        actor.actorId = actorId;
      }

      actor.throttleLevel = level;
      actor.throttleReason = reason;

      const config = this.rateLimitConfigs.get(level);
      if (config) {
        actor.throttlePercent = config.percentReduction;

        if (config.suspensionPeriodMinutes > 0) {
          const suspensionDuration = durationMinutes || config.suspensionPeriodMinutes;
          actor.throttledUntil = new Date(
            Date.now() + suspensionDuration * 60 * 1000,
          );
        }
      }

      const updated = await this.suspiciousActorRepository.save(actor);

      this.logger.log(
        `Throttle applied to ${actorId}: ${level} (${reason})`,
      );

      return updated;
    } catch (error) {
      this.logger.error(`Error applying throttle: ${error.message}`);
      throw error;
    }
  }

  /**
   * Automatic throttling based on violation count
   */
  async autoThrottleIfNeeded(actorId: string): Promise<void> {
    try {
      // Count critical alerts in last hour
      const oneHourAgo = new Date(Date.now() - 3600000);
      const criticalAlerts = await this.anomalyAlertRepository.count({
        where: {
          actorId,
          severity: SeverityLevel.CRITICAL,
          createdAt: new Date(oneHourAgo.getTime()),
        },
      });

      const actor = await this.suspiciousActorRepository.findOne({
        where: { actorId },
      });

      if (!actor) return;

      // Escalation logic
      if (criticalAlerts >= this.AUTO_SUSPEND_THRESHOLD) {
        // Auto-suspend
        if (actor.throttleLevel !== ThrottleLevel.SUSPENDED) {
          await this.applyThrottle(
            actorId,
            ThrottleLevel.SUSPENDED,
            `Auto-suspension: ${criticalAlerts} critical alerts in 1 hour`,
            1440, // 24 hours
          );
        }
      } else if (criticalAlerts >= Math.ceil(this.AUTO_SUSPEND_THRESHOLD * 0.75)) {
        // Escalate to SEVERE
        if (
          actor.throttleLevel === ThrottleLevel.NONE ||
          actor.throttleLevel === ThrottleLevel.WARNING
        ) {
          await this.applyThrottle(
            actorId,
            ThrottleLevel.SEVERE,
            `High violation rate: ${criticalAlerts} critical alerts`,
          );
        }
      } else if (criticalAlerts >= Math.ceil(this.AUTO_SUSPEND_THRESHOLD * 0.5)) {
        // Escalate to MODERATE
        if (
          actor.throttleLevel === ThrottleLevel.NONE ||
          actor.throttleLevel === ThrottleLevel.WARNING ||
          actor.throttleLevel === ThrottleLevel.LIGHT
        ) {
          await this.applyThrottle(
            actorId,
            ThrottleLevel.MODERATE,
            `Elevated violations: ${criticalAlerts} critical alerts`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Error in auto-throttle: ${error.message}`);
    }
  }

  /**
   * Reduce throttle level (after period of good behavior)
   */
  async reduceThrottle(actorId: string): Promise<SuspiciousActor | null> {
    try {
      const actor = await this.suspiciousActorRepository.findOne({
        where: { actorId },
      });

      if (!actor) return null;

      // Check for escalation in last 24 hours
      const dayAgo = new Date(Date.now() - 86400000);
      const recentViolations = await this.anomalyAlertRepository.count({
        where: {
          actorId,
          createdAt: new Date(dayAgo.getTime()),
        },
      });

      // Can only reduce if no recent violations
      if (recentViolations > 0) {
        this.logger.warn(
          `Cannot reduce throttle for ${actorId}: ${recentViolations} violations in last 24h`,
        );
        return actor;
      }

      // Reduce one level
      const currentLevel = actor.throttleLevel;
      const nextLevel = this.getNextLowerLevel(currentLevel);

      if (nextLevel === currentLevel) {
        this.logger.log(`Actor ${actorId} already at minimum throttle level`);
        return actor;
      }

      actor.throttleLevel = nextLevel;
      actor.throttlePercent = this.rateLimitConfigs.get(nextLevel)?.percentReduction || 0;
      actor.throttledUntil = null;

      const updated = await this.suspiciousActorRepository.save(actor);

      this.logger.log(
        `Throttle reduced for ${actorId}: ${currentLevel} → ${nextLevel}`,
      );

      return updated;
    } catch (error) {
      this.logger.error(`Error reducing throttle: ${error.message}`);
      return null;
    }
  }

  /**
   * Get next lower throttle level
   */
  private getNextLowerLevel(current: ThrottleLevel): ThrottleLevel {
    const levels = [
      ThrottleLevel.SUSPENDED,
      ThrottleLevel.SEVERE,
      ThrottleLevel.MODERATE,
      ThrottleLevel.LIGHT,
      ThrottleLevel.WARNING,
      ThrottleLevel.NONE,
    ];

    const currentIndex = levels.indexOf(current);
    if (currentIndex < levels.length - 1) {
      return levels[currentIndex + 1];
    }
    return current;
  }

  /**
   * Submit appeal for throttle reduction
   */
  async submitAppeal(request: AppealRequest): Promise<AppealResponse> {
    try {
      const appealId = `appeal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const appeal: AppealResponse = {
        appealId,
        status: 'PENDING',
        submittedAt: new Date(),
      };

      this.appeals.set(appealId, appeal);

      this.logger.log(`Appeal submitted for ${request.actorId}: ${appealId}`);

      return appeal;
    } catch (error) {
      this.logger.error(`Error submitting appeal: ${error.message}`);
      throw error;
    }
  }

  /**
   * Decide on appeal
   */
  async decideAppeal(
    appealId: string,
    approved: boolean,
    reason: string,
    decisionMaker: string,
  ): Promise<AppealResponse | null> {
    try {
      const appeal = this.appeals.get(appealId);

      if (!appeal) {
        this.logger.warn(`Appeal not found: ${appealId}`);
        return null;
      }

      appeal.status = approved ? 'APPROVED' : 'REJECTED';
      appeal.decisionReason = reason;
      appeal.decidedAt = new Date();

      this.logger.log(
        `Appeal ${appealId} decided: ${appeal.status} (${decisionMaker})`,
      );

      return appeal;
    } catch (error) {
      this.logger.error(`Error deciding appeal: ${error.message}`);
      return null;
    }
  }

  /**
   * Get actor throttle status
   */
  async getThrottleStatus(actorId: string): Promise<{
    actor: SuspiciousActor | null;
    config: RateLimitConfig | null;
    isCurrentlySuspended: boolean;
  }> {
    try {
      const actor = await this.suspiciousActorRepository.findOne({
        where: { actorId },
      });

      if (!actor) {
        return { actor: null, config: null, isCurrentlySuspended: false };
      }

      const config = this.rateLimitConfigs.get(actor.throttleLevel);
      const isCurrentlySuspended =
        actor.throttleLevel === ThrottleLevel.SUSPENDED &&
        actor.throttledUntil &&
        new Date() < actor.throttledUntil;

      return { actor, config: config || null, isCurrentlySuspended };
    } catch (error) {
      this.logger.error(`Error fetching throttle status: ${error.message}`);
      return { actor: null, config: null, isCurrentlySuspended: false };
    }
  }

  /**
   * Get throttle statistics
   */
  async getThrottleStats(): Promise<Record<string, any>> {
    try {
      const stats = {
        suspended: await this.suspiciousActorRepository.count({
          where: { throttleLevel: ThrottleLevel.SUSPENDED },
        }),
        severe: await this.suspiciousActorRepository.count({
          where: { throttleLevel: ThrottleLevel.SEVERE },
        }),
        moderate: await this.suspiciousActorRepository.count({
          where: { throttleLevel: ThrottleLevel.MODERATE },
        }),
        light: await this.suspiciousActorRepository.count({
          where: { throttleLevel: ThrottleLevel.LIGHT },
        }),
        warning: await this.suspiciousActorRepository.count({
          where: { throttleLevel: ThrottleLevel.WARNING },
        }),
        total: await this.suspiciousActorRepository.count(),
      };

      stats['percentThrottled'] = stats.total > 0
        ? ((stats.suspended + stats.severe + stats.moderate + stats.light) / stats.total) * 100
        : 0;

      return stats;
    } catch (error) {
      this.logger.error(`Error fetching throttle stats: ${error.message}`);
      return {};
    }
  }

  /**
   * Record order for rate limit tracking
   */
  private recordOrder(key: string, orderSize: number): void {
    if (!this.orderTracking.has(key)) {
      this.orderTracking.set(key, []);
    }

    this.orderTracking.get(key).push({ timestamp: new Date(), orderSize });

    // Trim old entries (keep only last 5 minutes)
    const fiveMinutesAgo = Date.now() - 300000;
    const filtered = this.orderTracking.get(key)
      .filter(o => o.timestamp.getTime() > fiveMinutesAgo);
    this.orderTracking.set(key, filtered);
  }

  /**
   * Get recent orders within time window
   */
  private getRecentOrders(
    key: string,
    windowMs: number,
  ): Array<{ timestamp: Date; orderSize: number }> {
    if (!this.orderTracking.has(key)) {
      return [];
    }

    const now = Date.now();
    return this.orderTracking.get(key).filter(o => now - o.timestamp.getTime() < windowMs);
  }
}

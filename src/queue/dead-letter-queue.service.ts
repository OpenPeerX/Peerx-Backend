// src/queue/dead-letter-queue.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { QueueName } from './queue.constants';
import { RedisPoolService } from '../common/cache/redis-pool.service';
import { DEFAULT_DLQ_CONFIG, DLQConfig } from './queue.config';

export interface DLQItem {
  jobId: string;
  queueName: string;
  jobData: any;
  error: string;
  errorStack?: string;
  failedAt: Date;
  lastAttempt: number;
  maxAttempts: number;
  reason: DLQReason;
  metadata?: Record<string, any>;
}

export enum DLQReason {
  MAX_RETRIES_EXCEEDED = 'MAX_RETRIES_EXCEEDED',
  NON_RETRYABLE_ERROR = 'NON_RETRYABLE_ERROR',
  STALLED = 'STALLED',
  TIMEOUT = 'TIMEOUT',
  MANUAL = 'MANUAL',
}

/**
 * Canonical permanent-vs-retryable rule: a Bull job has permanently failed
 * once the attempts it has made reach the attempts configured for it.
 * `@OnQueueFailed` fires on every failed attempt, so processors must use
 * this check (mirroring `SchedulerFailoverService.canRetryJob`) to decide
 * when a failure is final and belongs in the DLQ.
 */
export function isPermanentFailure(job: Job): boolean {
  return (job.attemptsMade ?? 0) >= (job.opts.attempts ?? 3);
}

const DLQ_KEY_PREFIX = 'dlq';

/**
 * Dead Letter Queue Service
 *
 * Durable, Redis-backed store of permanently failed jobs. Each queue maps to
 * a Redis hash (`dlq:{queueName}`) keyed by job id, so DLQ items survive a
 * process restart and are visible to every instance of a horizontally scaled
 * deployment — the admin endpoints in `QueueAdminController` read and write
 * the same store the processors produce.
 *
 * Recovery is safe by construction: `recoverJob` re-enqueues the job onto
 * its original Bull queue first and only removes the DLQ entry after the
 * re-enqueue succeeds, so a failed recovery never loses the record.
 */
@Injectable()
export class DeadLetterQueueService {
  private readonly logger = new Logger(DeadLetterQueueService.name);
  private dlqConfig: DLQConfig = DEFAULT_DLQ_CONFIG;
  private dlqEventListeners: Set<(item: DLQItem) => void> = new Set();

  constructor(
    @InjectQueue(QueueName.NOTIFICATIONS)
    private notificationQueue: Queue,
    @InjectQueue(QueueName.EMAILS)
    private emailQueue: Queue,
    @InjectQueue(QueueName.REPORTS)
    private reportQueue: Queue,
    @InjectQueue(QueueName.CLEANUP)
    private cleanupQueue: Queue,
    @InjectQueue(QueueName.SWAPS)
    private swapQueue: Queue,
    private readonly redis: RedisPoolService,
  ) {
    this.startCleanupJob();
  }

  private dlqKey(queueName: string): string {
    return `${DLQ_KEY_PREFIX}:${queueName}`;
  }

  /**
   * Add a job to the dead letter queue (durable).
   */
  async addToDLQ(
    job: Job,
    error: Error | string,
    reason: DLQReason,
    queueName: string,
  ): Promise<DLQItem> {
    const dlqItem: DLQItem = {
      jobId: job.id.toString(),
      queueName,
      jobData: job.data,
      error:
        typeof error === 'string' ? error : error.message || 'Unknown error',
      errorStack: typeof error === 'string' ? undefined : error.stack,
      failedAt: new Date(),
      lastAttempt: job.attemptsMade || 0,
      maxAttempts: job.opts.attempts || 3,
      reason,
      metadata: {
        priority: job.opts.priority,
        createdAt: job.timestamp,
        processedBy: job.processedOn,
      },
    };

    await this.redis.withClient((client) =>
      client.hset(
        this.dlqKey(queueName),
        dlqItem.jobId,
        JSON.stringify(dlqItem),
      ),
    );

    this.logger.error(
      `Job ${job.id} moved to DLQ - Reason: ${reason}, Error: ${dlqItem.error}`,
    );

    // Notify listeners
    this.notifyDLQListeners(dlqItem);

    // Check if we should alert
    if (this.dlqConfig.notifyOnFailure) {
      await this.alertAdministrators(dlqItem);
    }

    // Check if threshold exceeded
    const queueDLQ = await this.getDLQItems(queueName);
    if (
      queueDLQ.length > this.dlqConfig.alertThreshold &&
      queueDLQ.length % 10 === 0
    ) {
      this.logger.warn(
        `DLQ for ${queueName} has reached ${queueDLQ.length} items`,
      );
    }

    return dlqItem;
  }

  /**
   * Retrieve DLQ items for a specific queue (oldest first).
   */
  async getDLQItems(queueName: string, limit?: number): Promise<DLQItem[]> {
    const fields = await this.redis.withClient((client) =>
      client.hgetall(this.dlqKey(queueName)),
    );
    let items = Object.values(fields)
      .map((raw) => this.deserialize(raw))
      .filter((item): item is DLQItem => item !== null)
      .sort((a, b) => a.failedAt.getTime() - b.failedAt.getTime());
    if (limit) {
      items = items.slice(-limit);
    }
    return items;
  }

  /**
   * Get DLQ statistics across all queues.
   */
  async getDLQStats(): Promise<
    Record<string, { count: number; oldestItem?: DLQItem }>
  > {
    const stats: Record<string, { count: number; oldestItem?: DLQItem }> = {};

    for (const queueName of Object.values(QueueName)) {
      const items = await this.getDLQItems(queueName);
      stats[queueName] = {
        count: items.length,
        oldestItem: items.length > 0 ? items[0] : undefined,
      };
    }

    return stats;
  }

  /**
   * Attempt to recover and retry a DLQ item. Re-enqueues first and only
   * removes the DLQ entry after the re-enqueue succeeds.
   */
  async recoverJob(queueName: string, jobId: string): Promise<boolean> {
    const raw = await this.redis.withClient((client) =>
      client.hget(this.dlqKey(queueName), jobId),
    );
    if (!raw) {
      this.logger.warn(`DLQ item ${jobId} not found in queue ${queueName}`);
      return false;
    }

    const item = this.deserialize(raw);
    if (!item) {
      this.logger.warn(`DLQ item ${jobId} in queue ${queueName} is corrupt`);
      return false;
    }

    const queue = this.getQueueByName(queueName);

    if (!queue) {
      this.logger.error(`Queue ${queueName} not found`);
      return false;
    }

    try {
      // Add job back to queue with reset attempts
      await queue.add(item.jobData, {
        attempts: item.maxAttempts,
        priority: item.metadata?.priority,
        delay: 0,
      });

      // Remove from DLQ only after the re-enqueue succeeded
      await this.redis.withClient((client) =>
        client.hdel(this.dlqKey(queueName), jobId),
      );

      this.logger.log(
        `Successfully recovered DLQ job ${jobId} from queue ${queueName}`,
      );

      return true;
    } catch (error) {
      this.logger.error(`Failed to recover DLQ job ${jobId}:`, error.stack);
      return false;
    }
  }

  /**
   * Remove a DLQ item permanently (durable).
   */
  async removeDLQItem(queueName: string, jobId: string): Promise<boolean> {
    const removed = await this.redis.withClient((client) =>
      client.hdel(this.dlqKey(queueName), jobId),
    );
    if (removed > 0) {
      this.logger.log(`Removed DLQ item ${jobId} from queue ${queueName}`);
    }
    return removed > 0;
  }

  /**
   * Clear all DLQ items for a queue (durable).
   */
  async clearDLQ(queueName: string): Promise<number> {
    const items = await this.getDLQItems(queueName);
    await this.redis.withClient((client) => client.del(this.dlqKey(queueName)));

    this.logger.log(
      `Cleared DLQ for queue ${queueName} (${items.length} items)`,
    );

    return items.length;
  }

  /**
   * Get a DLQ item by ID.
   */
  async getDLQItem(
    queueName: string,
    jobId: string,
  ): Promise<DLQItem | undefined> {
    const raw = await this.redis.withClient((client) =>
      client.hget(this.dlqKey(queueName), jobId),
    );
    const item = raw ? this.deserialize(raw) : undefined;
    return item ?? undefined;
  }

  /**
   * Subscribe to DLQ events
   */
  onDLQItem(callback: (item: DLQItem) => void): void {
    this.dlqEventListeners.add(callback);
  }

  /**
   * Unsubscribe from DLQ events
   */
  offDLQItem(callback: (item: DLQItem) => void): void {
    this.dlqEventListeners.delete(callback);
  }

  /**
   * Update DLQ configuration
   */
  setDLQConfig(config: Partial<DLQConfig>): void {
    this.dlqConfig = { ...this.dlqConfig, ...config };
    this.logger.log('DLQ configuration updated');
  }

  /**
   * Get current DLQ configuration
   */
  getDLQConfig(): DLQConfig {
    return this.dlqConfig;
  }

  // ==================== Private Methods ====================

  private deserialize(raw: string): DLQItem | null {
    try {
      const parsed = JSON.parse(raw) as DLQItem;
      // failedAt round-trips as an ISO string through JSON; restore a Date.
      parsed.failedAt = new Date(parsed.failedAt);
      return parsed;
    } catch {
      this.logger.warn(`Ignoring corrupt DLQ entry: ${raw.slice(0, 80)}`);
      return null;
    }
  }

  private notifyDLQListeners(item: DLQItem): void {
    this.dlqEventListeners.forEach((callback) => {
      try {
        callback(item);
      } catch (error) {
        this.logger.error('Error in DLQ event listener:', error);
      }
    });
  }

  private async alertAdministrators(item: DLQItem): Promise<void> {
    // This would integrate with your notification system
    // For now, just log the alert
    this.logger.warn(
      `[DLQ ALERT] Job ${item.jobId} permanently failed in queue ${item.queueName}: ${item.error}`,
    );
  }

  private startCleanupJob(): void {
    // Clean up old DLQ items periodically against the durable store.
    // unref() so the timer does not keep the process (or jest) alive.
    const timer = setInterval(
      () => {
        this.cleanupExpiredItems().catch((error) => {
          this.logger.error('DLQ cleanup sweep failed:', error);
        });
      },
      60 * 60 * 1000,
    ); // Run every hour
    timer.unref();
  }

  private async cleanupExpiredItems(): Promise<void> {
    const cutoffTime = Date.now() - this.dlqConfig.maxAge;

    for (const queueName of Object.values(QueueName)) {
      const fields = await this.redis.withClient((client) =>
        client.hgetall(this.dlqKey(queueName)),
      );
      const staleIds = Object.entries(fields)
        .filter(([, raw]) => {
          const item = this.deserialize(raw);
          return item !== null && item.failedAt.getTime() <= cutoffTime;
        })
        .map(([jobId]) => jobId);

      if (staleIds.length > 0) {
        await this.redis.withClient((client) =>
          client.hdel(this.dlqKey(queueName), ...staleIds),
        );
        this.logger.debug(
          `Cleaned up ${staleIds.length} old DLQ items from ${queueName}`,
        );
      }
    }
  }

  private getQueueByName(queueName: string): Queue | null {
    switch (queueName as QueueName) {
      case QueueName.NOTIFICATIONS:
        return this.notificationQueue;
      case QueueName.EMAILS:
        return this.emailQueue;
      case QueueName.REPORTS:
        return this.reportQueue;
      case QueueName.CLEANUP:
        return this.cleanupQueue;
      case QueueName.SWAPS:
        return this.swapQueue;
      default:
        return null;
    }
  }
}

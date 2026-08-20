// src/queue/zero-loss-message.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import type { Redis } from 'ioredis';
import { RedisPoolService } from '../common/cache/redis-pool.service';
import {
  HorizontalScalingConfig,
  DEFAULT_HORIZONTAL_SCALING_CONFIG,
} from './horizontal-scaling.config';

const KEY_PREFIX = 'zls';
const NODES_KEY = `${KEY_PREFIX}:nodes`;
const msgKey = (messageId: string) => `${KEY_PREFIX}:msg:${messageId}`;
const queueKey = (queueName: string) => `${KEY_PREFIX}:queue:${queueName}`;
const leaseKey = (messageId: string) => `${KEY_PREFIX}:lease:${messageId}`;

/**
 * How often the recovery sweep scans for orphaned `processing` messages.
 * Kept below the default acknowledgment timeout (5s) so a dead worker's
 * message is re-queued within a few seconds of its lease expiring.
 */
const RECOVERY_SWEEP_INTERVAL_MS = 1000;

/**
 * Message persistence entry
 */
export interface PersistedMessage {
  messageId: string;
  queueName: string;
  /** Payload, JSON-round-tripped through the durable store. */
  data: unknown;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  updatedAt: Date;
  acknowledgedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
  replicationNodes: string[];
}

/**
 * Zero-Loss Message Service
 *
 * Durable, horizontally-shared message state backed by Redis (the same
 * infrastructure Bull already uses). All state lives in Redis, so a process
 * restart or scale-out loses nothing:
 *
 * - `zls:msg:{id}`        — hash with the full PersistedMessage (status,
 *                           attempts, payload, timestamps, replication targets)
 * - `zls:queue:{name}`    — set of message ids per queue (for listing)
 * - `zls:nodes`           — set of registered replication nodes (shared)
 * - `zls:lease:{id}`      — processing lease, a `SET ... EX ... NX` key. A
 *                           worker claims it atomically on markProcessing and
 *                           renews it while alive; when it expires (crash), a
 *                           recovery sweep re-claims it with NX and
 *                           transitions `processing -> pending` exactly once.
 *
 * A worker that is still alive keeps renewing its lease, so the sweep never
 * re-queues a message whose worker is actually progressing. Delivery remains
 * at-least-once: if a worker exceeds the lease without renewing, its message
 * is re-queued even if the worker later finishes.
 */
@Injectable()
export class ZeroLossMessageService {
  private readonly logger = new Logger(ZeroLossMessageService.name);
  private readonly instanceId = randomUUID();
  private config: HorizontalScalingConfig;

  constructor(
    private readonly redis: RedisPoolService,
    private eventEmitter: EventEmitter2,
  ) {
    this.config = DEFAULT_HORIZONTAL_SCALING_CONFIG;
    this.logger.log('Zero-Loss Message Service initialized (durable store)');
  }

  private get leaseTtlSeconds(): number {
    return Math.max(
      1,
      Math.ceil(this.config.zeroLoss.acknowledgmentTimeoutMs / 1000),
    );
  }

  // ==================== Replication nodes ====================

  /**
   * Register a replication node. Nodes live in a shared Redis set, so every
   * instance of the deployment sees the same registration set.
   */
  async registerReplicationNode(nodeId: string): Promise<void> {
    await this.redis.withClient((client) => client.sadd(NODES_KEY, nodeId));
    this.logger.log(`Replication node registered: ${nodeId}`);
  }

  /**
   * Unregister a replication node.
   */
  async unregisterReplicationNode(nodeId: string): Promise<void> {
    await this.redis.withClient((client) => client.srem(NODES_KEY, nodeId));
    this.logger.log(`Replication node unregistered: ${nodeId}`);
  }

  private async getReplicationTargets(): Promise<string[]> {
    const nodes = await this.redis.withClient((client) =>
      client.smembers(NODES_KEY),
    );
    nodes.sort();
    const count = Math.min(
      this.config.zeroLoss.replicationFactor,
      nodes.length,
    );
    return nodes.slice(0, count);
  }

  // ==================== Message lifecycle ====================

  /**
   * Persist a message durably. The message is written to Redis (shared across
   * instances) before this method resolves; replication targets are captured
   * from the shared node set at persist time.
   */
  async persistMessage(
    messageId: string,
    queueName: string,
    data: unknown,
    maxAttempts: number = this.config.zeroLoss.maxRetryAttempts,
  ): Promise<PersistedMessage> {
    const now = new Date();

    const message: PersistedMessage = {
      messageId,
      queueName,
      data,
      status: 'pending',
      attempts: 0,
      maxAttempts,
      createdAt: now,
      updatedAt: now,
      replicationNodes: await this.getReplicationTargets(),
    };

    await this.redis.withClient(async (client) => {
      await client.hset(msgKey(messageId), this.toHashFields(message));
      await client.sadd(queueKey(queueName), messageId);
    });

    this.logger.debug(`Message persisted: ${messageId} (queue: ${queueName})`);
    this.eventEmitter.emit('message.persisted', { messageId, queueName });

    return message;
  }

  /**
   * Atomically claim a pending message for processing. The claim is a
   * `SET zls:lease:{id} <instance> EX <timeout> NX`, so at most one worker
   * across all instances can hold the lease; every other concurrent caller
   * gets `false`. The lease expires automatically after the acknowledgment
   * timeout unless renewed with {@link renewProcessingLease}.
   */
  async markProcessing(messageId: string): Promise<boolean> {
    return this.redis.withClient(async (client) => {
      const claimed = await client.set(
        leaseKey(messageId),
        this.instanceId,
        'EX',
        this.leaseTtlSeconds,
        'NX',
      );
      if (!claimed) {
        return false; // lease already held — another worker is processing it
      }

      const status = await client.hget(msgKey(messageId), 'status');
      if (status !== 'pending') {
        await client.del(leaseKey(messageId));
        return false;
      }

      const attempts = await client.hincrby(msgKey(messageId), 'attempts', 1);
      const maxAttempts = Number(
        await client.hget(msgKey(messageId), 'maxAttempts'),
      );
      await client.hset(
        msgKey(messageId),
        'status',
        'processing',
        'updatedAt',
        new Date().toISOString(),
        'leaseUntil',
        String(Date.now() + this.config.zeroLoss.acknowledgmentTimeoutMs),
      );

      this.logger.debug(
        `Message marked as processing: ${messageId} (attempt ${attempts}/${maxAttempts})`,
      );
      return true;
    });
  }

  /**
   * Renew the processing lease of a message this instance is currently
   * working on. A live worker calls this periodically so the recovery sweep
   * never re-queues a message that is actually progressing.
   */
  async renewProcessingLease(messageId: string): Promise<boolean> {
    return this.redis.withClient(async (client) => {
      const owner = await client.get(leaseKey(messageId));
      if (owner !== this.instanceId) {
        return false; // lease lost (expired/recovered) or never held
      }
      const renewed = await client.expire(
        leaseKey(messageId),
        this.leaseTtlSeconds,
      );
      if (renewed === 1) {
        await client.hset(
          msgKey(messageId),
          'updatedAt',
          new Date().toISOString(),
          'leaseUntil',
          String(Date.now() + this.config.zeroLoss.acknowledgmentTimeoutMs),
        );
        return true;
      }
      return false;
    });
  }

  /**
   * Acknowledge message processing. Marks the message acknowledged and
   * releases the lease, so the recovery sweep will not re-queue it.
   */
  async acknowledgeMessage(messageId: string): Promise<boolean> {
    return this.redis.withClient(async (client) => {
      const status = await client.hget(msgKey(messageId), 'status');
      if (!status) {
        this.logger.warn(`Message not found for acknowledgment: ${messageId}`);
        return false;
      }
      await client.hset(
        msgKey(messageId),
        'acknowledgedAt',
        new Date().toISOString(),
        'updatedAt',
        new Date().toISOString(),
        'leaseUntil',
        '',
      );
      await client.del(leaseKey(messageId));
      this.logger.debug(`Message acknowledged: ${messageId}`);
      this.eventEmitter.emit('message.acknowledged', { messageId });
      return true;
    });
  }

  /**
   * Mark message as completed.
   */
  async markCompleted(messageId: string): Promise<boolean> {
    return this.redis.withClient(async (client) => {
      const status = await client.hget(msgKey(messageId), 'status');
      if (!status) return false;
      await client.hset(
        msgKey(messageId),
        'status',
        'completed',
        'completedAt',
        new Date().toISOString(),
        'updatedAt',
        new Date().toISOString(),
        'leaseUntil',
        '',
      );
      await client.del(leaseKey(messageId));
      this.logger.debug(`Message completed: ${messageId}`);
      this.eventEmitter.emit('message.completed', { messageId });
      return true;
    });
  }

  /**
   * Mark message as failed.
   */
  async markFailed(messageId: string, error: string): Promise<boolean> {
    return this.redis.withClient(async (client) => {
      const status = await client.hget(msgKey(messageId), 'status');
      if (!status) return false;
      await client.hset(
        msgKey(messageId),
        'status',
        'failed',
        'error',
        error,
        'failedAt',
        new Date().toISOString(),
        'updatedAt',
        new Date().toISOString(),
        'leaseUntil',
        '',
      );
      await client.del(leaseKey(messageId));
      this.logger.warn(`Message failed: ${messageId} - ${error}`);
      this.eventEmitter.emit('message.failed', { messageId, error });
      return true;
    });
  }

  /**
   * Retry a failed message (pending again, lease released). No-op once the
   * message has exhausted maxAttempts.
   */
  async retryMessage(messageId: string): Promise<boolean> {
    return this.redis.withClient(async (client) => {
      const attempts = Number(await client.hget(msgKey(messageId), 'attempts'));
      const maxAttempts = Number(
        await client.hget(msgKey(messageId), 'maxAttempts'),
      );
      if (!attempts && !maxAttempts) {
        this.logger.warn(`Message not found for retry: ${messageId}`);
        return false;
      }
      if (attempts >= maxAttempts) {
        this.logger.warn(`Message ${messageId} has exceeded max attempts`);
        return false;
      }
      await client.hset(
        msgKey(messageId),
        'status',
        'pending',
        'error',
        '',
        'updatedAt',
        new Date().toISOString(),
        'leaseUntil',
        '',
      );
      await client.del(leaseKey(messageId));
      this.logger.log(`Message retry initiated: ${messageId}`);
      this.eventEmitter.emit('message.retried', { messageId });
      return true;
    });
  }

  // ==================== Recovery ====================

  /**
   * Recovery sweep. Scans the durable message hashes (which never expire)
   * for messages stuck in `processing` whose lease has expired — the lease is
   * a TTL key, so its disappearance *is* the crash signal. Each orphan is
   * atomically transitioned back to `pending` — or to `failed` once
   * maxAttempts are exhausted. The `SET ... NX` re-claim guarantees the
   * transition runs exactly once even when several instances sweep the same
   * message concurrently, and a worker that is still alive holds the lease,
   * so its message is never touched.
   */
  @Interval(RECOVERY_SWEEP_INTERVAL_MS)
  async recoverOrphanedMessages(): Promise<number> {
    const recovered: string[] = [];
    await this.redis.withClient(async (client) => {
      const messageKeys = await this.scanKeys(client, `${KEY_PREFIX}:msg:*`);
      for (const key of messageKeys) {
        const messageId = key.slice(msgKey('').length);
        if (await this.recoverOne(client, messageId)) {
          recovered.push(messageId);
        }
      }
    });
    if (recovered.length > 0) {
      this.logger.log(
        `Recovery sweep re-queued ${recovered.length} orphaned message(s)`,
      );
    }
    return recovered.length;
  }

  private async recoverOne(client: Redis, messageId: string): Promise<boolean> {
    const message = await this.getHashMessage(client, messageId);
    if (!message || message.status !== 'processing' || message.acknowledgedAt) {
      return false; // not orphaned (or already acknowledged)
    }

    // A live lease means a worker is still processing the message — skip.
    const leaseOwner = await client.get(leaseKey(messageId));
    if (leaseOwner) return false;

    // Lease expired (worker crashed). Re-claim it: only one sweep across all
    // instances can win the NX, so the transition happens exactly once.
    const claimed = await client.set(
      leaseKey(messageId),
      `${this.instanceId}:recovery`,
      'EX',
      this.leaseTtlSeconds,
      'NX',
    );
    if (!claimed) return false;

    try {
      // Re-check under the claim: a concurrent sweep may have already
      // transitioned or acknowledged the message.
      const current = await this.getHashMessage(client, messageId);
      if (
        !current ||
        current.status !== 'processing' ||
        current.acknowledgedAt
      ) {
        return false;
      }

      if (current.attempts < current.maxAttempts) {
        await client.hset(
          msgKey(messageId),
          'status',
          'pending',
          'updatedAt',
          new Date().toISOString(),
          'leaseUntil',
          '',
        );
        this.logger.warn(
          `Acknowledgment timeout for message: ${messageId} — re-queued`,
        );
        this.eventEmitter.emit('message.requeued', {
          messageId,
          reason: 'acknowledgment-timeout',
        });
      } else {
        await client.hset(
          msgKey(messageId),
          'status',
          'failed',
          'error',
          'Acknowledgment timeout',
          'failedAt',
          new Date().toISOString(),
          'updatedAt',
          new Date().toISOString(),
          'leaseUntil',
          '',
        );
        this.logger.error(`Message failed after max attempts: ${messageId}`);
        this.eventEmitter.emit('message.failed', {
          messageId,
          reason: 'max-attempts-exceeded',
        });
      }
      return true;
    } finally {
      await client.del(leaseKey(messageId));
    }
  }

  // ==================== Reads ====================

  /**
   * Get message by ID.
   */
  async getMessage(messageId: string): Promise<PersistedMessage | undefined> {
    return this.redis.withClient((client) =>
      this.getHashMessage(client, messageId),
    );
  }

  /**
   * Get all messages for a queue.
   */
  async getQueueMessages(queueName: string): Promise<PersistedMessage[]> {
    return this.redis.withClient(async (client) => {
      const ids = await client.smembers(queueKey(queueName));
      const messages: PersistedMessage[] = [];
      for (const id of ids) {
        const message = await this.getHashMessage(client, id);
        if (message) messages.push(message);
      }
      return messages;
    });
  }

  /**
   * Get messages by status.
   */
  async getMessagesByStatus(
    status: PersistedMessage['status'],
  ): Promise<PersistedMessage[]> {
    const messages = await this.getAllMessages();
    return messages.filter((m) => m.status === status);
  }

  /**
   * Get pending messages (for recovery).
   */
  async getPendingMessages(): Promise<PersistedMessage[]> {
    return this.getMessagesByStatus('pending');
  }

  /**
   * Get failed messages (for manual intervention).
   */
  async getFailedMessages(): Promise<PersistedMessage[]> {
    return this.getMessagesByStatus('failed');
  }

  /**
   * Clean up completed messages older than maxAgeMs.
   */
  async cleanupCompletedMessages(
    maxAgeMs: number = 24 * 60 * 60 * 1000,
  ): Promise<number> {
    const cutoffTime = Date.now() - maxAgeMs;
    let cleanedCount = 0;
    await this.redis.withClient(async (client) => {
      const keys = await this.scanKeys(client, `${KEY_PREFIX}:msg:*`);
      for (const key of keys) {
        const messageId = key.slice(msgKey('').length);
        const message = await this.getHashMessage(client, messageId);
        if (
          message &&
          message.status === 'completed' &&
          message.completedAt &&
          message.completedAt.getTime() < cutoffTime
        ) {
          await client.del(key);
          await client.srem(queueKey(message.queueName), messageId);
          cleanedCount++;
        }
      }
    });
    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} completed messages`);
    }
    return cleanedCount;
  }

  /**
   * Get message statistics.
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    replicationNodes: number;
    activeLeases: number;
  }> {
    const messages = await this.getAllMessages();
    const replicationNodes = await this.redis.withClient((client) =>
      client.scard(NODES_KEY),
    );
    const activeLeases = await this.redis.withClient(
      async (client) =>
        (await this.scanKeys(client, `${KEY_PREFIX}:lease:*`)).length,
    );

    return {
      total: messages.length,
      pending: messages.filter((m) => m.status === 'pending').length,
      processing: messages.filter((m) => m.status === 'processing').length,
      completed: messages.filter((m) => m.status === 'completed').length,
      failed: messages.filter((m) => m.status === 'failed').length,
      replicationNodes,
      activeLeases,
    };
  }

  /**
   * Verify message integrity.
   */
  async verifyMessageIntegrity(messageId: string): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const message = await this.getMessage(messageId);
    const issues: string[] = [];

    if (!message) {
      return { valid: false, issues: ['Message not found'] };
    }

    // Check for orphaned processing state (lease expired)
    if (message.status === 'processing' && !message.acknowledgedAt) {
      const leaseAlive = await this.redis.withClient((client) =>
        client.get(leaseKey(messageId)),
      );
      if (!leaseAlive) {
        issues.push('Message stuck in processing state (lease expired)');
      }
    }

    // Check for missing replication
    if (
      message.replicationNodes.length < this.config.zeroLoss.replicationFactor
    ) {
      issues.push(
        `Insufficient replication: ${message.replicationNodes.length}/${this.config.zeroLoss.replicationFactor}`,
      );
    }

    // Check for excessive retries
    if (message.attempts > message.maxAttempts) {
      issues.push('Exceeded max retry attempts');
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  // ==================== Configuration ====================

  /**
   * Update configuration.
   */
  updateConfig(newConfig: Partial<HorizontalScalingConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };
    this.logger.log('Zero-loss message configuration updated');
  }

  /**
   * Get current configuration.
   */
  getConfig(): HorizontalScalingConfig {
    return { ...this.config };
  }

  // ==================== Internals ====================

  private async getAllMessages(): Promise<PersistedMessage[]> {
    return this.redis.withClient(async (client) => {
      const keys = await this.scanKeys(client, `${KEY_PREFIX}:msg:*`);
      const messages: PersistedMessage[] = [];
      for (const key of keys) {
        const message = await this.getHashMessage(
          client,
          key.slice(msgKey('').length),
        );
        if (message) messages.push(message);
      }
      return messages;
    });
  }

  private async getHashMessage(
    client: Redis,
    messageId: string,
  ): Promise<PersistedMessage | undefined> {
    const fields = await client.hgetall(msgKey(messageId));
    if (!fields.messageId) return undefined;
    return {
      messageId: fields.messageId,
      queueName: fields.queueName,
      data: JSON.parse(fields.data ?? 'null') as unknown,
      status: fields.status as PersistedMessage['status'],
      attempts: Number(fields.attempts),
      maxAttempts: Number(fields.maxAttempts),
      createdAt: new Date(fields.createdAt),
      updatedAt: new Date(fields.updatedAt),
      acknowledgedAt: fields.acknowledgedAt
        ? new Date(fields.acknowledgedAt)
        : undefined,
      completedAt: fields.completedAt
        ? new Date(fields.completedAt)
        : undefined,
      failedAt: fields.failedAt ? new Date(fields.failedAt) : undefined,
      error: fields.error || undefined,
      replicationNodes: JSON.parse(fields.replicationNodes ?? '[]') as string[],
    };
  }

  private toHashFields(message: PersistedMessage): Record<string, string> {
    return {
      messageId: message.messageId,
      queueName: message.queueName,
      data: JSON.stringify(message.data ?? null),
      status: message.status,
      attempts: String(message.attempts),
      maxAttempts: String(message.maxAttempts),
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
      acknowledgedAt: message.acknowledgedAt?.toISOString() ?? '',
      completedAt: message.completedAt?.toISOString() ?? '',
      failedAt: message.failedAt?.toISOString() ?? '',
      error: message.error ?? '',
      replicationNodes: JSON.stringify(message.replicationNodes),
      leaseUntil: '',
    };
  }

  private async scanKeys(client: Redis, pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [nextCursor, batch] = await client.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      keys.push(...batch);
      cursor = nextCursor;
    } while (cursor !== '0');
    return keys;
  }
}

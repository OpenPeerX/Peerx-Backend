// src/queue/processors/swap.processor.ts
import {
  Processor,
  Process,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
} from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { QueueName } from '../queue.constants';
import {
  BatchSwapJobData,
  MultiLegSwapJobData,
  SingleSwapJobData,
  SwapJobData,
} from '../queue.service';
import { LiquidityPoolService } from '../../exchange/services/liquidity-pool.service';
import { RedisPoolService } from '../../common/cache/redis-pool.service';
import {
  DeadLetterQueueService,
  DLQReason,
} from '../dead-letter-queue.service';

/**
 * Error thrown when a swap job is missing data that can never be resolved
 * (for example a `poolId`), so retrying is pointless.
 */
export class NonRetryableSwapError extends Error {}

/**
 * How long an executed-swap idempotency marker survives. Kept shorter than
 * the default `removeOnFail` retention (7 days) so a finished job's markers
 * age out instead of accumulating forever, while still covering Bull's
 * retry window and the audit retention.
 */
const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

const singleKey = (swapId: string) => `swap:executed:${swapId}`;
const legKey = (swapId: string, index: number) =>
  `swap:executed:${swapId}:leg:${index}`;

/**
 * Swap Job Processor
 *
 * Consumes the `swaps` Bull queue (registered in `QueueModule`) that
 * `QueueService.addSingleSwapJob` / `addMultiLegSwapJob` / `addBatchSwapJob`
 * enqueue. Executes each job against the AMM swap path
 * (`LiquidityPoolService.swap`), with a durable Redis idempotency guard so a
 * Bull retry never executes the same swap twice:
 *
 * - single   — guarded by `swap:executed:{swapId}` (SET NX EX). The guard is
 *              claimed before execution and released on failure, so a retry
 *              re-executes only swaps that genuinely failed; a retry of an
 *              executed swap short-circuits.
 * - multi_leg — legs execute sequentially, each guarded by its own
 *              `swap:executed:{swapId}:leg:{index}` key. A leg failure fails
 *              the job and the retry resumes at the first unexecuted leg;
 *              completed legs are never re-executed. (No compensation/
 *              rollback mechanism exists in the AMM path, so completed legs
 *              are not reversed — documented semantics.)
 * - batch     — best-effort: every sub-swap is attempted independently with
 *              its own per-swapId guard. Failures are collected and the job
 *              fails after all swaps have been attempted, so the retry only
 *              re-attempts the failed swaps (successful ones keep their
 *              guard). Not all-or-nothing — documented semantics.
 *
 * Permanent failures are moved to the Dead Letter Queue.
 */
@Processor(QueueName.SWAPS)
export class SwapJobProcessor {
  private readonly logger = new Logger(SwapJobProcessor.name);

  constructor(
    private readonly liquidityPoolService: LiquidityPoolService,
    private readonly redis: RedisPoolService,
    private readonly dlq: DeadLetterQueueService,
  ) {}

  @Process({ name: 'single', concurrency: 5 })
  async processSingle(job: Job<SingleSwapJobData>): Promise<void> {
    const { swapId, userId, fromAsset, amount, poolId, minAmountOut } =
      job.data;

    this.logger.log(`Processing single swap job ${job.id}: swapId=${swapId}`);
    await job.progress(10);

    const key = singleKey(swapId);
    if (!(await this.claim(key))) {
      this.logger.warn(
        `Swap ${swapId} already executed (idempotency guard), skipping`,
      );
      await job.progress(100);
      return;
    }

    try {
      this.requirePoolId(job.data);
      await this.executeSwap({
        swapId,
        userId,
        tokenIn: fromAsset,
        amountIn: amount,
        poolId: poolId as number,
        minAmountOut,
      });
      await job.progress(100);
    } catch (error) {
      await this.release(key);
      throw error;
    }
  }

  @Process({ name: 'multi_leg', concurrency: 2 })
  async processMultiLeg(job: Job<MultiLegSwapJobData>): Promise<void> {
    const { swapId, userId, legs } = job.data;

    this.logger.log(
      `Processing multi-leg swap job ${job.id}: swapId=${swapId} legs=${legs.length}`,
    );
    await job.progress(5);

    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      const key = legKey(swapId, i);

      if (!(await this.claim(key))) {
        this.logger.warn(
          `Leg ${i} of swap ${swapId} already executed, skipping`,
        );
        continue;
      }

      try {
        this.requirePoolId(leg);
        await this.executeSwap({
          swapId: `${swapId}:leg:${i}`,
          userId,
          tokenIn: leg.fromAsset,
          amountIn: leg.amount,
          poolId: leg.poolId as number,
          minAmountOut: leg.minAmountOut,
        });
        await job.progress(5 + ((i + 1) / legs.length) * 90);
      } catch (error) {
        await this.release(key);
        throw error;
      }
    }

    await job.progress(100);
  }

  @Process({ name: 'batch', concurrency: 1 })
  async processBatch(job: Job<BatchSwapJobData>): Promise<void> {
    const { batchId, swaps } = job.data;

    this.logger.log(
      `Processing batch swap job ${job.id}: batchId=${batchId} swaps=${swaps.length}`,
    );
    await job.progress(5);

    const failures: string[] = [];
    let attempted = 0;
    for (const swap of swaps) {
      const key = singleKey(swap.swapId);
      if (!(await this.claim(key))) {
        this.logger.warn(
          `Swap ${swap.swapId} in batch ${batchId} already executed, skipping`,
        );
        continue;
      }

      attempted += 1;
      try {
        this.requirePoolId(swap);
        await this.executeSwap({
          swapId: swap.swapId,
          userId: swap.userId,
          tokenIn: swap.fromAsset,
          amountIn: swap.amount,
          poolId: swap.poolId as number,
          minAmountOut: swap.minAmountOut,
        });
        await job.progress(5 + (attempted / swaps.length) * 90);
      } catch (error) {
        await this.release(key);
        failures.push(
          `${swap.swapId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (failures.length > 0) {
      throw new Error(
        `Batch ${batchId}: ${failures.length}/${swaps.length} swaps failed: ${failures.join('; ')}`,
      );
    }

    await job.progress(100);
  }

  @OnQueueActive()
  onActive(job: Job<SwapJobData>): void {
    this.logger.debug(`Swap job ${job.id} is now active: ${job.data.swapId}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job<SwapJobData>): void {
    this.logger.log(`Swap job ${job.id} completed: swapId=${job.data.swapId}`);
  }

  @OnQueueFailed()
  async onFailed(job: Job<SwapJobData>, error: Error): Promise<void> {
    const attempts = job.opts.attempts || 3;
    this.logger.error(
      `Swap job ${job.id} failed. swapId=${job.data.swapId}. ` +
        `Attempt ${job.attemptsMade}/${attempts}`,
      error.stack,
    );

    if (job.attemptsMade >= attempts) {
      const reason =
        error instanceof NonRetryableSwapError
          ? DLQReason.NON_RETRYABLE_ERROR
          : DLQReason.MAX_RETRIES_EXCEEDED;
      await this.dlq.addToDLQ(job, error, reason, QueueName.SWAPS);
      this.logger.error(`Swap job ${job.id} moved to DLQ - Reason: ${reason}`);
    }
  }

  // ==================== Private helpers ====================

  /**
   * Atomically claim an idempotency key. Returns `false` when another
   * attempt (or a previous successful one) already holds the key.
   */
  private async claim(key: string): Promise<boolean> {
    const claimed = await this.redis.withClient((client) =>
      client.set(key, '1', 'EX', IDEMPOTENCY_TTL_SECONDS, 'NX'),
    );
    return claimed === 'OK';
  }

  private async release(key: string): Promise<void> {
    await this.redis.withClient((client) => client.del(key));
  }

  private requirePoolId(data: { poolId?: number }): void {
    if (data.poolId === undefined) {
      throw new NonRetryableSwapError(
        'Swap job is missing poolId; cannot resolve the AMM pool. ' +
          'Re-enqueue with poolId (and optionally minAmountOut) set.',
      );
    }
  }

  private async executeSwap(data: {
    swapId: string;
    userId: string;
    tokenIn: string;
    amountIn: number;
    poolId: number;
    minAmountOut?: number;
  }): Promise<void> {
    const result = await this.liquidityPoolService.swap(data.poolId, {
      userId: Number(data.userId),
      tokenIn: data.tokenIn,
      amountIn: data.amountIn,
      minAmountOut: data.minAmountOut,
    });
    this.logger.log(
      `Swap ${data.swapId} executed: ${data.amountIn} ${data.tokenIn} -> ${result.swap.amountOut}`,
    );
  }
}

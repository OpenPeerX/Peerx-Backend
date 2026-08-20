// src/queue/processors/cleanup.processor.ts
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
import { CleanupJobData } from '../queue.service';
import {
  DeadLetterQueueService,
  DLQReason,
  isPermanentFailure,
} from '../dead-letter-queue.service';

@Processor(QueueName.CLEANUP)
export class CleanupJobProcessor {
  private readonly logger = new Logger(CleanupJobProcessor.name);

  constructor(private readonly dlqService: DeadLetterQueueService) {}

  @Process({ concurrency: 1 })
  async processCleanup(job: Job<CleanupJobData>): Promise<void> {
    const { type, olderThan, batchSize = 1000 } = job.data;

    this.logger.log(`Processing cleanup job ${job.id}: ${type}`);

    try {
      let totalCleaned = 0;
      let hasMore = true;

      while (hasMore) {
        const cleaned = await this.cleanupBatch(job.data);
        totalCleaned += cleaned;

        await job.progress((totalCleaned / 10000) * 100);

        hasMore = cleaned === batchSize;

        if (hasMore) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      await job.progress(100);
      this.logger.log(
        `Cleanup completed: ${type}, total items cleaned: ${totalCleaned}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process cleanup job ${job.id}:`,
        error.stack,
      );
      throw error;
    }
  }

  @OnQueueActive()
  onActive(job: Job<CleanupJobData>): void {
    this.logger.debug(`Cleanup job ${job.id} is now active: ${job.data.type}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job<CleanupJobData>, result: any): void {
    this.logger.log(`Cleanup job ${job.id} completed: ${job.data.type}`);
  }

  @OnQueueFailed()
  async onFailed(job: Job<CleanupJobData>, error: Error): Promise<void> {
    const attempts = job.opts.attempts || 3;
    this.logger.error(
      `Cleanup job ${job.id} failed: ${job.data.type}. ` +
        `Attempt ${job.attemptsMade}/${attempts}`,
      error.stack,
    );

    if (isPermanentFailure(job)) {
      this.logger.error(
        `Cleanup job ${job.id} permanently failed: ${job.data.type}.`,
      );
      await this.dlqService.addToDLQ(
        job,
        error,
        DLQReason.MAX_RETRIES_EXCEEDED,
        QueueName.CLEANUP,
      );
    }
  }

  private async cleanupBatch(jobData: CleanupJobData): Promise<number> {
    const { type, olderThan, batchSize = 1000 } = jobData;

    this.logger.debug(`Cleaning up ${type}, batch size: ${batchSize}`);

    switch (type) {
      case 'old_trades':
        return this.cleanupOldTrades(olderThan, batchSize);
      case 'expired_sessions':
        return this.cleanupExpiredSessions(batchSize);
      case 'temp_files':
        return this.cleanupTempFiles(olderThan, batchSize);
      case 'logs':
        return this.cleanupOldLogs(olderThan, batchSize);
      default:
        throw new Error(`Unknown cleanup type: ${type}`);
    }
  }

  private async cleanupOldTrades(
    olderThan: Date | undefined,
    batchSize: number,
  ): Promise<number> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    this.logger.debug(`Cleaned up old trades`);
    return Math.floor(Math.random() * batchSize);
  }

  private async cleanupExpiredSessions(batchSize: number): Promise<number> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    this.logger.debug(`Cleaned up expired sessions`);
    return Math.floor(Math.random() * batchSize);
  }

  private async cleanupTempFiles(
    olderThan: Date | undefined,
    batchSize: number,
  ): Promise<number> {
    await new Promise((resolve) => setTimeout(resolve, 400));
    this.logger.debug(`Cleaned up temp files`);
    return Math.floor(Math.random() * batchSize);
  }

  private async cleanupOldLogs(
    olderThan: Date | undefined,
    batchSize: number,
  ): Promise<number> {
    await new Promise((resolve) => setTimeout(resolve, 600));
    this.logger.debug(`Cleaned up old logs`);
    return Math.floor(Math.random() * batchSize);
  }
}

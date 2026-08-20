// src/queue/processors/dlq-wiring.spec.ts
import { EmailJobProcessor } from './email.processor';
import { NotificationJobProcessor } from './notification.processor';
import { ReportJobProcessor } from './report.processor';
import { CleanupJobProcessor } from './cleanup.processor';
import {
  DeadLetterQueueService,
  DLQReason,
} from '../dead-letter-queue.service';
import { QueueName } from '../queue.constants';
import type { Job } from 'bull';

function makeJob(
  data: Record<string, unknown>,
  attemptsMade: number,
  attempts: number,
): Job {
  return {
    id: 'job-1',
    data,
    attemptsMade,
    opts: { attempts },
    failedReason: undefined,
  } as unknown as Job;
}

describe('processor → DLQ wiring', () => {
  let addToDLQ: jest.Mock;

  const dlq = {
    provide: DeadLetterQueueService,
    useValue: { addToDLQ: jest.fn() },
  };

  beforeEach(() => {
    addToDLQ = dlq.useValue.addToDLQ;
    addToDLQ.mockClear();
    addToDLQ.mockResolvedValue({});
  });

  it('email processor routes a permanently failed job to the DLQ', async () => {
    const processor = new EmailJobProcessor(
      dlq.useValue as unknown as DeadLetterQueueService,
    );
    const job = makeJob({ to: 'a@b.c', subject: 'x' }, 3, 3);

    await processor.onFailed(job, new Error('SMTP timeout'));

    expect(addToDLQ).toHaveBeenCalledWith(
      job,
      expect.any(Error),
      DLQReason.MAX_RETRIES_EXCEEDED,
      QueueName.EMAILS,
    );
  });

  it('email processor does not DLQ a retryable failure', async () => {
    const processor = new EmailJobProcessor(
      dlq.useValue as unknown as DeadLetterQueueService,
    );
    const job = makeJob({ to: 'a@b.c', subject: 'x' }, 1, 3);

    await processor.onFailed(job, new Error('transient'));

    expect(addToDLQ).not.toHaveBeenCalled();
  });

  it('notification processor routes a permanently failed job to the DLQ', async () => {
    const processor = new NotificationJobProcessor(
      dlq.useValue as unknown as DeadLetterQueueService,
    );
    const job = makeJob(
      { userId: 'u1', type: 'system_alert', title: 't', message: 'm' },
      3,
      3,
    );

    await processor.onFailed(job, new Error('push failed'));

    expect(addToDLQ).toHaveBeenCalledWith(
      job,
      expect.any(Error),
      DLQReason.MAX_RETRIES_EXCEEDED,
      QueueName.NOTIFICATIONS,
    );
  });

  it('report processor routes a permanently failed job to the DLQ', async () => {
    const processor = new ReportJobProcessor(
      dlq.useValue as unknown as DeadLetterQueueService,
    );
    const job = makeJob(
      {
        reportType: 'daily',
        startDate: new Date(),
        endDate: new Date(),
        format: 'pdf',
      },
      2,
      2,
    );

    await processor.onFailed(job, new Error('generation failed'));

    expect(addToDLQ).toHaveBeenCalledWith(
      job,
      expect.any(Error),
      DLQReason.MAX_RETRIES_EXCEEDED,
      QueueName.REPORTS,
    );
  });

  it('cleanup processor routes a permanently failed job to the DLQ', async () => {
    const processor = new CleanupJobProcessor(
      dlq.useValue as unknown as DeadLetterQueueService,
    );
    const job = makeJob({ type: 'old_trades' }, 3, 3);

    await processor.onFailed(job, new Error('cleanup failed'));

    expect(addToDLQ).toHaveBeenCalledWith(
      job,
      expect.any(Error),
      DLQReason.MAX_RETRIES_EXCEEDED,
      QueueName.CLEANUP,
    );
  });

  it('cleanup processor does not DLQ a retryable failure', async () => {
    const processor = new CleanupJobProcessor(
      dlq.useValue as unknown as DeadLetterQueueService,
    );
    const job = makeJob({ type: 'old_trades' }, 1, 3);

    await processor.onFailed(job, new Error('transient'));

    expect(addToDLQ).not.toHaveBeenCalled();
  });
});

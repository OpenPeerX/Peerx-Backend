// src/queue/dead-letter-queue.service.spec.ts
import { DeadLetterQueueService, DLQReason } from './dead-letter-queue.service';
import { RedisPoolService } from '../common/cache/redis-pool.service';
import { QueueName } from './queue.constants';
import type { Job, Queue } from 'bull';

// ── Faithful in-memory Redis fake (hash + set + del semantics) ───────────────

type HashEntry = Record<string, string>;

class FakeRedis {
  private hashes = new Map<string, HashEntry>();

  hset(key: string, field: string, value: string): Promise<number> {
    const entry = this.hashes.get(key) ?? {};
    entry[field] = value;
    this.hashes.set(key, entry);
    return Promise.resolve(1);
  }

  hget(key: string, field: string): Promise<string | null> {
    return Promise.resolve(this.hashes.get(key)?.[field] ?? null);
  }

  hgetall(key: string): Promise<Record<string, string>> {
    return Promise.resolve({ ...(this.hashes.get(key) ?? {}) });
  }

  hdel(key: string, ...fields: string[]): Promise<number> {
    const entry = this.hashes.get(key);
    if (!entry) return Promise.resolve(0);
    let removed = 0;
    for (const field of fields) {
      if (field in entry) {
        delete entry[field];
        removed += 1;
      }
    }
    return Promise.resolve(removed);
  }

  del(key: string): Promise<number> {
    return Promise.resolve(this.hashes.delete(key) ? 1 : 0);
  }
}

// ── Job factory helper ───────────────────────────────────────────────────────

function makeJob(
  data: Record<string, unknown>,
  overrides: Partial<Job> = {},
): Job {
  return {
    id: 'job-1',
    data,
    attemptsMade: 3,
    opts: { attempts: 3 },
    timestamp: Date.now(),
    processedOn: Date.now(),
    ...overrides,
  } as unknown as Job;
}

describe('DeadLetterQueueService', () => {
  let service: DeadLetterQueueService;
  let fakeRedis: FakeRedis;
  const queues: Partial<Record<QueueName, { add: jest.Mock; name: string }>> =
    {};

  function buildService(): DeadLetterQueueService {
    const provider = {
      provide: RedisPoolService,
      useValue: {
        withClient: (fn: (c: FakeRedis) => Promise<unknown>) => fn(fakeRedis),
      },
    };
    // Construct directly (avoids the hourly cleanup interval in the
    // constructor being registered repeatedly across reinstantiations).
    const svc = new DeadLetterQueueService(
      queues[QueueName.NOTIFICATIONS] as unknown as Queue,
      queues[QueueName.EMAILS] as unknown as Queue,
      queues[QueueName.REPORTS] as unknown as Queue,
      queues[QueueName.CLEANUP] as unknown as Queue,
      queues[QueueName.SWAPS] as unknown as Queue,
      provider.useValue as unknown as RedisPoolService,
    );
    return svc;
  }

  beforeEach(() => {
    fakeRedis = new FakeRedis();
    for (const name of Object.values(QueueName)) {
      queues[name] = {
        name,
        add: jest.fn().mockResolvedValue({ id: 'new-job' }),
      };
    }
    service = buildService();
  });

  it('adds a permanently failed job to the DLQ with its reason', async () => {
    const job = makeJob({ userId: 1, message: 'hi' });

    const item = await service.addToDLQ(
      job,
      new Error('SMTP timeout'),
      DLQReason.MAX_RETRIES_EXCEEDED,
      QueueName.EMAILS,
    );

    expect(item.jobId).toBe('job-1');
    expect(item.reason).toBe(DLQReason.MAX_RETRIES_EXCEEDED);
    expect(item.maxAttempts).toBe(3);

    const items = await service.getDLQItems(QueueName.EMAILS);
    expect(items).toHaveLength(1);
    expect(items[0].error).toBe('SMTP timeout');
  });

  it('persists DLQ items across a service reinstantiation (restart survival)', async () => {
    await service.addToDLQ(
      makeJob({ userId: 1 }),
      new Error('boom'),
      DLQReason.MAX_RETRIES_EXCEEDED,
      QueueName.NOTIFICATIONS,
    );

    // Simulate a process restart: new service instance, same durable store.
    const restarted = buildService();
    const items = await restarted.getDLQItems(QueueName.NOTIFICATIONS);

    expect(items).toHaveLength(1);
    expect(items[0].error).toBe('boom');
    expect(items[0].failedAt).toBeInstanceOf(Date);
  });

  it('recoverJob re-enqueues and removes the item only on success', async () => {
    const queue = queues[QueueName.EMAILS] as { add: jest.Mock; name: string };
    const addMock = queue.add;
    addMock.mockResolvedValue({ id: 'requeued' });

    await service.addToDLQ(
      makeJob({ to: 'a@b.c', subject: 'x' }),
      new Error('retryable-ish failure'),
      DLQReason.MAX_RETRIES_EXCEEDED,
      QueueName.EMAILS,
    );

    const recovered = await service.recoverJob(QueueName.EMAILS, 'job-1');

    expect(recovered).toBe(true);
    expect(addMock).toHaveBeenCalledWith(
      { to: 'a@b.c', subject: 'x' },
      expect.objectContaining({ attempts: 3, delay: 0 }),
    );
    expect(await service.getDLQItems(QueueName.EMAILS)).toHaveLength(0);
  });

  it('recoverJob keeps the DLQ item when re-enqueueing fails', async () => {
    const queue = queues[QueueName.EMAILS] as { add: jest.Mock; name: string };
    const addMock = queue.add;
    addMock.mockRejectedValue(new Error('redis down'));

    await service.addToDLQ(
      makeJob({ to: 'a@b.c' }),
      new Error('first failure'),
      DLQReason.MAX_RETRIES_EXCEEDED,
      QueueName.EMAILS,
    );

    const recovered = await service.recoverJob(QueueName.EMAILS, 'job-1');

    expect(recovered).toBe(false);
    // Item must still be present so a later recovery attempt can find it.
    expect(await service.getDLQItems(QueueName.EMAILS)).toHaveLength(1);
  });

  it('recoverJob returns false for an unknown job', async () => {
    const recovered = await service.recoverJob(QueueName.EMAILS, 'nope');
    expect(recovered).toBe(false);
  });

  it('clearDLQ removes all items for a queue from the durable store', async () => {
    await service.addToDLQ(
      makeJob({ a: 1 }, { id: 'job-1' }),
      new Error('e1'),
      DLQReason.MAX_RETRIES_EXCEEDED,
      QueueName.REPORTS,
    );
    await service.addToDLQ(
      makeJob({ a: 2 }, { id: 'job-2' }),
      new Error('e2'),
      DLQReason.MAX_RETRIES_EXCEEDED,
      QueueName.REPORTS,
    );

    const cleared = await service.clearDLQ(QueueName.REPORTS);

    expect(cleared).toBe(2);
    expect(await service.getDLQItems(QueueName.REPORTS)).toHaveLength(0);
    // Other queues are untouched.
    expect(await service.getDLQStats()).toBeDefined();
  });

  it('removeDLQItem deletes a single item from the durable store', async () => {
    await service.addToDLQ(
      makeJob({ a: 1 }),
      new Error('e1'),
      DLQReason.MAX_RETRIES_EXCEEDED,
      QueueName.CLEANUP,
    );

    expect(await service.removeDLQItem(QueueName.CLEANUP, 'job-1')).toBe(true);
    expect(await service.getDLQItems(QueueName.CLEANUP)).toHaveLength(0);
    expect(await service.removeDLQItem(QueueName.CLEANUP, 'job-1')).toBe(false);
  });

  it('getDLQStats reports counts per queue', async () => {
    await service.addToDLQ(
      makeJob({ a: 1 }),
      new Error('e1'),
      DLQReason.MAX_RETRIES_EXCEEDED,
      QueueName.EMAILS,
    );

    const stats = await service.getDLQStats();
    expect(stats[QueueName.EMAILS].count).toBe(1);
    expect(stats[QueueName.NOTIFICATIONS].count).toBe(0);
  });
});

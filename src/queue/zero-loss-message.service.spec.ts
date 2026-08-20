// src/queue/zero-loss-message.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ZeroLossMessageService } from './zero-loss-message.service';
import { RedisPoolService } from '../common/cache/redis-pool.service';

/**
 * Faithful in-memory implementation of the ioredis command surface the
 * zero-loss service uses. It models Redis semantics that matter here:
 * `SET ... EX ... NX` atomicity (single-threaded, so the NX guard is exact),
 * per-key TTL expiry, hashes, sets and SCAN. A test "restarts" a service by
 * building a new instance over the same fake — exactly like two deployment
 * instances sharing one real Redis.
 */
type FakeEntry =
  | { type: 'string'; value: string; expiresAtMs: number | null }
  | { type: 'hash'; fields: Map<string, string>; expiresAtMs: number | null }
  | { type: 'set'; members: Set<string>; expiresAtMs: number | null };

class FakeRedis {
  private store = new Map<string, FakeEntry>();
  nowMs: () => number = () => Date.now();

  private isAlive(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (entry.expiresAtMs !== null && entry.expiresAtMs <= this.nowMs()) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!this.isAlive(key) || !entry || entry.type !== 'string')
      return Promise.resolve(null);
    return Promise.resolve(entry.value);
  }

  set(key: string, value: string, ...args: unknown[]): Promise<'OK' | null> {
    const exIndex = args.indexOf('EX');
    const nx = args.includes('NX');
    if (nx && this.isAlive(key)) return Promise.resolve(null);
    const seconds = exIndex >= 0 ? Number(args[exIndex + 1]) : 0;
    this.store.set(key, {
      type: 'string',
      value,
      expiresAtMs: seconds > 0 ? this.nowMs() + seconds * 1000 : null,
    });
    return Promise.resolve('OK');
  }

  del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) {
      if (this.isAlive(key)) {
        this.store.delete(key);
        removed++;
      }
    }
    return Promise.resolve(removed);
  }

  expire(key: string, seconds: number): Promise<number> {
    const entry = this.store.get(key);
    if (!this.isAlive(key) || !entry) return Promise.resolve(0);
    entry.expiresAtMs = this.nowMs() + seconds * 1000;
    return Promise.resolve(1);
  }

  hget(key: string, field: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!this.isAlive(key) || !entry || entry.type !== 'hash')
      return Promise.resolve(null);
    return Promise.resolve(entry.fields.get(field) ?? null);
  }

  hset(
    key: string,
    ...args: Array<string | Record<string, string>>
  ): Promise<number> {
    // ioredis accepts both `hset(key, field, value, ...)` and the object
    // form `hset(key, { field: value })`; flatten the latter like ioredis does.
    const fields =
      args.length === 1 && typeof args[0] === 'object'
        ? Object.entries(args[0]).flat()
        : (args as string[]);
    let entry = this.store.get(key);
    if (!this.isAlive(key) || !entry || entry.type !== 'hash') {
      entry = { type: 'hash', fields: new Map(), expiresAtMs: null };
      this.store.set(key, entry);
    }
    let added = 0;
    for (let i = 0; i < fields.length; i += 2) {
      if (!entry.fields.has(fields[i])) added++;
      entry.fields.set(fields[i], fields[i + 1]);
    }
    return Promise.resolve(added);
  }

  hgetall(key: string): Promise<Record<string, string>> {
    const entry = this.store.get(key);
    if (!this.isAlive(key) || !entry || entry.type !== 'hash')
      return Promise.resolve({});
    return Promise.resolve(Object.fromEntries(entry.fields));
  }

  hincrby(key: string, field: string, incr: number): Promise<number> {
    let entry = this.store.get(key);
    if (!this.isAlive(key) || !entry || entry.type !== 'hash') {
      entry = { type: 'hash', fields: new Map(), expiresAtMs: null };
      this.store.set(key, entry);
    }
    const next = Number(entry.fields.get(field) ?? 0) + incr;
    entry.fields.set(field, String(next));
    return Promise.resolve(next);
  }

  sadd(key: string, ...members: string[]): Promise<number> {
    let entry = this.store.get(key);
    if (!this.isAlive(key) || !entry || entry.type !== 'set') {
      entry = { type: 'set', members: new Set(), expiresAtMs: null };
      this.store.set(key, entry);
    }
    let added = 0;
    for (const member of members) {
      if (!entry.members.has(member)) {
        entry.members.add(member);
        added++;
      }
    }
    return Promise.resolve(added);
  }

  srem(key: string, ...members: string[]): Promise<number> {
    const entry = this.store.get(key);
    if (!this.isAlive(key) || !entry || entry.type !== 'set')
      return Promise.resolve(0);
    let removed = 0;
    for (const member of members) {
      if (entry.members.delete(member)) removed++;
    }
    return Promise.resolve(removed);
  }

  smembers(key: string): Promise<string[]> {
    const entry = this.store.get(key);
    if (!this.isAlive(key) || !entry || entry.type !== 'set')
      return Promise.resolve([]);
    return Promise.resolve([...entry.members]);
  }

  scard(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!this.isAlive(key) || !entry || entry.type !== 'set')
      return Promise.resolve(0);
    return Promise.resolve(entry.members.size);
  }

  scan(
    cursor: string,
    match: string,
    pattern: string,
    count: string,
    limit: number,
  ): Promise<[string, string[]]> {
    void match;
    void count;
    void limit;
    const prefix = pattern.slice(0, pattern.indexOf('*'));
    const keys: string[] = [];
    for (const key of this.store.keys()) {
      if (this.isAlive(key) && key.startsWith(prefix)) keys.push(key);
    }
    return Promise.resolve(['0', keys]);
  }

  flushAll(): void {
    this.store.clear();
  }

  /** Advance the fake clock by ms (expires TTL'd keys). */
  advance(ms: number): void {
    const base = Date.now();
    this.nowMs = () => base + ms;
  }
}

describe('ZeroLossMessageService (durable store)', () => {
  let fake: FakeRedis;
  let eventEmitter: { emit: jest.Mock };

  const requeueCount = (): number =>
    eventEmitter.emit.mock.calls.filter(([name]) => name === 'message.requeued')
      .length;

  const buildService = async (): Promise<ZeroLossMessageService> => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ZeroLossMessageService,
        {
          provide: RedisPoolService,
          useValue: {
            withClient: jest.fn(
              async <T>(fn: (client: FakeRedis) => Promise<T> | T) => fn(fake),
            ),
          },
        },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();
    return module.get(ZeroLossMessageService);
  };

  beforeEach(() => {
    fake = new FakeRedis();
    eventEmitter = { emit: jest.fn() };
    // Pinned clock: service timestamps (createdAt/updatedAt/completedAt) and
    // lease TTLs all derive from Date.now(), so tests advance time with the
    // same mechanism that expires Redis keys.
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-20T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('persists messages durably across a simulated restart', async () => {
    const svcA = await buildService();
    await svcA.persistMessage('m1', 'emails', { to: 'a@example.com' });

    // "Restart": a fresh instance over the same store.
    const svcB = await buildService();
    const recovered = await svcB.getMessage('m1');

    expect(recovered).toBeDefined();
    expect(recovered!.status).toBe('pending');
    expect(recovered!.data).toEqual({ to: 'a@example.com' });
    expect(recovered!.queueName).toBe('emails');

    // The recovered message is claimable by the new instance.
    expect(await svcB.markProcessing('m1')).toBe(true);
  });

  it('re-queues an orphaned processing message exactly once', async () => {
    const svcA = await buildService();
    await svcA.persistMessage('m1', 'emails', {});
    expect(await svcA.markProcessing('m1')).toBe(true);

    // Simulate a crash: the lease TTL (5s default) expires.
    jest.advanceTimersByTime(6000);

    const svcB = await buildService();
    await svcB.recoverOrphanedMessages();

    const message = await svcB.getMessage('m1');
    expect(message!.status).toBe('pending');
    expect(requeueCount()).toBe(1);

    // A fresh worker can now claim it again.
    expect(await svcB.markProcessing('m1')).toBe(true);
  });

  it('never double-processes: concurrent sweeps transition exactly once', async () => {
    const svcA = await buildService();
    await svcA.persistMessage('m1', 'emails', {});
    await svcA.markProcessing('m1');

    jest.advanceTimersByTime(6000);
    const svcB = await buildService();
    const svcC = await buildService();

    await Promise.all([
      svcB.recoverOrphanedMessages(),
      svcC.recoverOrphanedMessages(),
    ]);

    const message = await svcB.getMessage('m1');
    expect(message!.status).toBe('pending');
    // Exactly one sweep won the lease claim; only it emitted the requeue.
    expect(requeueCount()).toBe(1);
  });

  it('fails a message instead of re-queuing once maxAttempts are exhausted', async () => {
    const svcA = await buildService();
    await svcA.persistMessage('m1', 'emails', {}, 1);
    await svcA.markProcessing('m1'); // attempts -> 1, maxAttempts 1

    jest.advanceTimersByTime(6000);
    await svcA.recoverOrphanedMessages();

    const message = await svcA.getMessage('m1');
    expect(message!.status).toBe('failed');
    expect(message!.error).toBe('Acknowledgment timeout');
    expect(requeueCount()).toBe(0);
  });

  it('does not re-queue a message whose worker renews its lease', async () => {
    const svcA = await buildService();
    await svcA.persistMessage('m1', 'emails', {});
    await svcA.markProcessing('m1');

    // Worker still alive: renews near the lease boundary.
    jest.advanceTimersByTime(4000);
    expect(await svcA.renewProcessingLease('m1')).toBe(true);

    // Past the original TTL but within the renewed lease — sweep must skip.
    jest.advanceTimersByTime(4000);
    await svcA.recoverOrphanedMessages();
    expect((await svcA.getMessage('m1'))!.status).toBe('processing');
    expect(requeueCount()).toBe(0);

    // Worker gone now: lease expired, message is re-queued.
    jest.advanceTimersByTime(3000);
    await svcA.recoverOrphanedMessages();
    expect((await svcA.getMessage('m1'))!.status).toBe('pending');
    expect(requeueCount()).toBe(1);
  });

  it('never re-queues an acknowledged message', async () => {
    const svcA = await buildService();
    await svcA.persistMessage('m1', 'emails', {});
    await svcA.markProcessing('m1');
    await svcA.acknowledgeMessage('m1');

    jest.advanceTimersByTime(6000);
    await svcA.recoverOrphanedMessages();

    const message = await svcA.getMessage('m1');
    expect(message!.status).toBe('processing'); // not re-queued
    expect(message!.acknowledgedAt).toBeDefined();
    expect(requeueCount()).toBe(0);

    await svcA.markCompleted('m1');
    expect((await svcA.getMessage('m1'))!.status).toBe('completed');
  });

  it('shares replication nodes across instances and survives restart', async () => {
    const svcA = await buildService();
    await svcA.registerReplicationNode('node-1');

    const svcB = await buildService();
    await svcB.registerReplicationNode('node-2');

    // A third instance sees both nodes and captures both as targets.
    const svcC = await buildService();
    await svcC.persistMessage('m1', 'emails', {});
    const message = await svcC.getMessage('m1');
    expect([...message!.replicationNodes].sort()).toEqual(['node-1', 'node-2']);

    expect((await svcC.getStats()).replicationNodes).toBe(2);

    // Unregistering through one instance is visible to the others.
    await svcB.unregisterReplicationNode('node-1');
    expect((await svcA.getStats()).replicationNodes).toBe(1);
  });

  it('tracks stats and cleans up old completed messages', async () => {
    const svcA = await buildService();
    await svcA.persistMessage('m1', 'emails', {});
    await svcA.persistMessage('m2', 'reports', {});

    const stats = await svcA.getStats();
    expect(stats.total).toBe(2);
    expect(stats.pending).toBe(2);

    await svcA.markProcessing('m1');
    const processing = await svcA.getMessagesByStatus('processing');
    expect(processing.map((m) => m.messageId)).toEqual(['m1']);

    // Force-complete m1 with an old timestamp so cleanup removes it.
    await svcA.acknowledgeMessage('m1');
    await svcA.markCompleted('m1');
    jest.advanceTimersByTime(24 * 60 * 60 * 1000 + 1000);

    const cleaned = await svcA.cleanupCompletedMessages();
    expect(cleaned).toBe(1);
    expect(await svcA.getMessage('m1')).toBeUndefined();
    expect(await svcA.getMessage('m2')).toBeDefined();
  });
});

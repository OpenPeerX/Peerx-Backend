// src/queue/processors/swap.processor.spec.ts
import { Test } from '@nestjs/testing';
import { SwapJobProcessor, NonRetryableSwapError } from './swap.processor';
import { LiquidityPoolService } from '../../exchange/services/liquidity-pool.service';
import { RedisPoolService } from '../../common/cache/redis-pool.service';
import {
  DeadLetterQueueService,
  DLQReason,
} from '../dead-letter-queue.service';
import type { Job } from 'bull';
import {
  BatchSwapJobData,
  MultiLegSwapJobData,
  SingleSwapJobData,
} from '../queue.service';

// ── Faithful in-memory Redis fake (SET NX EX, DEL) ───────────────────────────

interface FakeEntry {
  value: string;
  expiresAtMs: number | null;
}

class FakeRedis {
  private store = new Map<string, FakeEntry>();

  nowMs(): number {
    return Date.now();
  }

  set(
    key: string,
    value: string,
    mode?: string,
    ttl?: number,
    nxFlag?: string,
  ): Promise<'OK' | null> {
    const now = this.nowMs();
    const existing = this.store.get(key);
    if (
      existing &&
      (existing.expiresAtMs === null || existing.expiresAtMs > now)
    ) {
      if (nxFlag === 'NX') {
        return Promise.resolve(null);
      }
    }
    this.store.set(key, {
      value,
      expiresAtMs: mode === 'EX' ? now + (ttl ?? 0) * 1000 : null,
    });
    return Promise.resolve('OK');
  }

  get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return Promise.resolve(null);
    if (entry.expiresAtMs !== null && entry.expiresAtMs <= this.nowMs()) {
      this.store.delete(key);
      return Promise.resolve(null);
    }
    return Promise.resolve(entry.value);
  }

  del(key: string): Promise<number> {
    return Promise.resolve(this.store.delete(key) ? 1 : 0);
  }
}

// ── Job factory helpers ───────────────────────────────────────────────────────

function makeJob<T>(data: T, overrides: Partial<Job> = {}): Job<T> {
  return {
    id: 'job-1',
    data,
    attemptsMade: 1,
    opts: { attempts: 3 },
    progress: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as Job<T>;
}

const singleData: SingleSwapJobData = {
  swapId: 'swap-1',
  userId: '42',
  type: 'single',
  fromAsset: 'USDC',
  toAsset: 'PEER',
  amount: 100,
  poolId: 7,
};

const multiLegData: MultiLegSwapJobData = {
  swapId: 'swap-multi',
  userId: '42',
  type: 'multi_leg',
  legs: [
    { fromAsset: 'USDC', toAsset: 'PEER', amount: 50, poolId: 1 },
    { fromAsset: 'PEER', toAsset: 'USDT', amount: 50, poolId: 2 },
  ],
  data: {},
};

const batchData: BatchSwapJobData = {
  batchId: 'batch-1',
  swapIds: ['swap-b1', 'swap-b2', 'swap-b3'],
  type: 'batch',
  swapId: 'batch-1',
  userId: '42',
  data: {},
  swaps: [
    {
      swapId: 'swap-b1',
      userId: '42',
      type: 'single',
      fromAsset: 'USDC',
      toAsset: 'PEER',
      amount: 10,
      poolId: 1,
    },
    {
      swapId: 'swap-b2',
      userId: '42',
      type: 'single',
      fromAsset: 'USDC',
      toAsset: 'PEER',
      amount: 20,
      poolId: 1,
    },
    {
      swapId: 'swap-b3',
      userId: '42',
      type: 'single',
      fromAsset: 'USDC',
      toAsset: 'PEER',
      amount: 30,
      poolId: 1,
    },
  ],
};

describe('SwapJobProcessor', () => {
  let processor: SwapJobProcessor;
  let fakeRedis: FakeRedis;
  let swapService: { swap: jest.Mock };
  let dlq: { addToDLQ: jest.Mock };

  beforeEach(async () => {
    fakeRedis = new FakeRedis();
    swapService = {
      swap: jest.fn().mockResolvedValue({
        swap: { id: 'ps-1', amountOut: 95, status: 'COMPLETED' },
        pool: { id: 7 },
      }),
    };
    dlq = { addToDLQ: jest.fn().mockResolvedValue({}) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SwapJobProcessor,
        { provide: LiquidityPoolService, useValue: swapService },
        {
          provide: RedisPoolService,
          useValue: {
            withClient: (fn: (c: FakeRedis) => Promise<unknown>) =>
              fn(fakeRedis),
          },
        },
        { provide: DeadLetterQueueService, useValue: dlq },
      ],
    }).compile();

    processor = moduleRef.get(SwapJobProcessor);
  });

  describe('single swap', () => {
    it('executes a successful single swap against the AMM service', async () => {
      const job = makeJob(singleData);
      await processor.processSingle(job);

      expect(swapService.swap).toHaveBeenCalledTimes(1);
      expect(swapService.swap).toHaveBeenCalledWith(7, {
        userId: 42,
        tokenIn: 'USDC',
        amountIn: 100,
        minAmountOut: undefined,
      });
    });

    it('does not execute the same swap twice on retry (idempotency guard)', async () => {
      const job = makeJob(singleData);
      await processor.processSingle(job);
      // Bull retries the same job payload after a transient failure.
      await processor.processSingle(job);

      expect(swapService.swap).toHaveBeenCalledTimes(1);
    });

    it('re-executes after a genuine failure (guard is released)', async () => {
      swapService.swap
        .mockRejectedValueOnce(new Error('horizon timeout'))
        .mockResolvedValueOnce({
          swap: { id: 'ps-2', amountOut: 95, status: 'COMPLETED' },
          pool: { id: 7 },
        });

      const job = makeJob(singleData);
      await expect(processor.processSingle(job)).rejects.toThrow(
        'horizon timeout',
      );
      await processor.processSingle(job);

      expect(swapService.swap).toHaveBeenCalledTimes(2);
    });

    it('fails with a non-retryable error when poolId is missing', async () => {
      const job = makeJob<SingleSwapJobData>({
        ...singleData,
        poolId: undefined,
      });

      await expect(processor.processSingle(job)).rejects.toBeInstanceOf(
        NonRetryableSwapError,
      );
      expect(swapService.swap).not.toHaveBeenCalled();
    });

    it('surfaces a failed job to the DLQ once attempts are exhausted', async () => {
      const job = makeJob(singleData, {
        attemptsMade: 3,
        opts: { attempts: 3 },
      });
      await processor.onFailed(job, new Error('AMM reverted'));

      expect(dlq.addToDLQ).toHaveBeenCalledWith(
        job,
        expect.any(Error),
        DLQReason.MAX_RETRIES_EXCEEDED,
        'swaps',
      );
    });

    it('marks non-retryable errors as NON_RETRYABLE_ERROR in the DLQ', async () => {
      const job = makeJob(singleData, {
        attemptsMade: 3,
        opts: { attempts: 3 },
      });
      await processor.onFailed(
        job,
        new NonRetryableSwapError('missing poolId'),
      );

      expect(dlq.addToDLQ).toHaveBeenCalledWith(
        job,
        expect.any(NonRetryableSwapError),
        DLQReason.NON_RETRYABLE_ERROR,
        'swaps',
      );
    });
  });

  describe('multi-leg swap', () => {
    it('executes every leg in order', async () => {
      const job = makeJob(multiLegData);
      await processor.processMultiLeg(job);

      expect(swapService.swap).toHaveBeenCalledTimes(2);
      expect(swapService.swap).toHaveBeenNthCalledWith(1, 1, {
        userId: 42,
        tokenIn: 'USDC',
        amountIn: 50,
        minAmountOut: undefined,
      });
      expect(swapService.swap).toHaveBeenNthCalledWith(2, 2, {
        userId: 42,
        tokenIn: 'PEER',
        amountIn: 50,
        minAmountOut: undefined,
      });
    });

    it('resumes at the failed leg on retry without re-executing completed legs', async () => {
      swapService.swap
        .mockResolvedValueOnce({
          swap: { id: 'ps-leg0', amountOut: 48, status: 'COMPLETED' },
          pool: { id: 1 },
        })
        .mockRejectedValueOnce(new Error('leg 2 liquidity insufficient'))
        .mockResolvedValueOnce({
          swap: { id: 'ps-leg1', amountOut: 48, status: 'COMPLETED' },
          pool: { id: 2 },
        });

      const job = makeJob(multiLegData);
      await expect(processor.processMultiLeg(job)).rejects.toThrow(
        'leg 2 liquidity insufficient',
      );
      // Retry: leg 1 must not re-execute; leg 2 succeeds this time.
      await processor.processMultiLeg(job);

      expect(swapService.swap).toHaveBeenCalledTimes(3);
      expect(swapService.swap).toHaveBeenNthCalledWith(2, 2, {
        userId: 42,
        tokenIn: 'PEER',
        amountIn: 50,
        minAmountOut: undefined,
      });
    });
  });

  describe('batch swap', () => {
    it('executes every sub-swap best-effort', async () => {
      const job = makeJob(batchData);
      await processor.processBatch(job);

      expect(swapService.swap).toHaveBeenCalledTimes(3);
    });

    it('attempts all swaps and fails the job when any sub-swap fails', async () => {
      swapService.swap
        .mockResolvedValueOnce({
          swap: { id: 'ps-b1', amountOut: 10, status: 'COMPLETED' },
          pool: { id: 1 },
        })
        .mockRejectedValueOnce(new Error('sub-swap b2 failed'))
        .mockResolvedValueOnce({
          swap: { id: 'ps-b3', amountOut: 28, status: 'COMPLETED' },
          pool: { id: 1 },
        });

      const job = makeJob(batchData);
      await expect(processor.processBatch(job)).rejects.toThrow(
        '1/3 swaps failed',
      );
      // All three were attempted (best-effort), even though one failed.
      expect(swapService.swap).toHaveBeenCalledTimes(3);
    });

    it('skips already-executed sub-swaps on retry of a partially failed batch', async () => {
      swapService.swap
        .mockResolvedValueOnce({
          swap: { id: 'ps-b1', amountOut: 10, status: 'COMPLETED' },
          pool: { id: 1 },
        })
        .mockRejectedValueOnce(new Error('sub-swap b2 failed'))
        .mockResolvedValueOnce({
          swap: { id: 'ps-b3', amountOut: 28, status: 'COMPLETED' },
          pool: { id: 1 },
        })
        .mockResolvedValueOnce({
          swap: { id: 'ps-b2', amountOut: 19, status: 'COMPLETED' },
          pool: { id: 1 },
        });

      const job = makeJob(batchData);
      await expect(processor.processBatch(job)).rejects.toThrow(
        '1/3 swaps failed',
      );
      await processor.processBatch(job);

      // Attempt 1: 3 calls. Attempt 2: only the failed sub-swap b2 (4th call).
      expect(swapService.swap).toHaveBeenCalledTimes(4);
    });
  });
});

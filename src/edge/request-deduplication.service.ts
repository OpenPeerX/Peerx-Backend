import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

export interface PendingRequest {
  id: string;
  key: string;
  promise: Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  createdAt: Date;
  requestCount: number;
  timeout: NodeJS.Timeout;
}

export interface DeduplicationStats {
  totalRequests: number;
  deduplicatedRequests: number;
  deduplicationRate: number;
  averageWaitTime: number;
  activePendingRequests: number;
}

@Injectable()
export class RequestDeduplicationService {
  private readonly logger = new Logger(RequestDeduplicationService.name);
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private stats = {
    totalRequests: 0,
    deduplicatedRequests: 0,
    totalWaitTime: 0,
  };

  constructor(private readonly configService: ConfigService) {
    this.startCleanupInterval();
  }

  private startCleanupInterval(): void {
    // Clean up stale pending requests every 10 seconds
    setInterval(() => {
      this.cleanupStaleRequests();
    }, 10000);
  }

  async deduplicate<T>(
    key: string,
    executor: () => Promise<T>,
    options: {
      timeout?: number;
      maxWait?: number;
    } = {}
  ): Promise<T> {
    this.stats.totalRequests++;
    const config = this.configService.get('edge');
    const timeout = options.timeout || config?.deduplication?.windowMs || 100;
    const maxWait = options.maxWait || 5000;

    // Check if there's already a pending request for this key
    const existing = this.pendingRequests.get(key);
    if (existing) {
      this.stats.deduplicatedRequests++;
      existing.requestCount++;
      
      this.logger.debug(
        `Deduplicating request: ${key} (${existing.requestCount} concurrent requests)`
      );

      // Return the existing promise
      return existing.promise as Promise<T>;
    }

    // Create a new pending request
    const requestId = uuidv4();
    let resolve: (value: T) => void;
    let reject: (error: any) => void;

    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    // Set up timeout
    const timeoutHandle = setTimeout(() => {
      this.pendingRequests.delete(key);
      reject(new Error(`Request deduplication timeout for key: ${key}`));
    }, maxWait);

    const pendingRequest: PendingRequest = {
      id: requestId,
      key,
      promise,
      resolve: resolve!,
      reject: reject!,
      createdAt: new Date(),
      requestCount: 1,
      timeout: timeoutHandle,
    };

    this.pendingRequests.set(key, pendingRequest);

    try {
      // Execute the actual request
      const result = await executor();
      
      // Resolve all waiting promises
      pendingRequest.resolve(result);
      
      // Calculate wait time
      const waitTime = Date.now() - pendingRequest.createdAt.getTime();
      this.stats.totalWaitTime += waitTime;

      this.logger.debug(
        `Request completed: ${key} (waited ${waitTime}ms, ${pendingRequest.requestCount} requests)`
      );

      return result;
    } catch (error) {
      // Reject all waiting promises
      pendingRequest.reject(error);
      throw error;
    } finally {
      // Clean up
      clearTimeout(timeoutHandle);
      this.pendingRequests.delete(key);
    }
  }

  async batch<T>(
    requests: Array<{ key: string; executor: () => Promise<T> }>,
    options: {
      concurrency?: number;
      timeout?: number;
    } = {}
  ): Promise<Array<{ key: string; result?: T; error?: Error }>> {
    const concurrency = options.concurrency || 10;
    const results: Array<{ key: string; result?: T; error?: Error }> = [];

    // Process requests in batches
    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency);
      
      const batchResults = await Promise.allSettled(
        batch.map(async request => {
          try {
            const result = await this.deduplicate(
              request.key,
              request.executor,
              { timeout: options.timeout }
            );
            return { key: request.key, result };
          } catch (error) {
            return { key: request.key, error: error as Error };
          }
        })
      );

      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            key: 'unknown',
            error: result.reason,
          });
        }
      });
    }

    return results;
  }

  async getPendingRequest(key: string): Promise<PendingRequest | null> {
    return this.pendingRequests.get(key) || null;
  }

  async cancelRequest(key: string): Promise<boolean> {
    const pending = this.pendingRequests.get(key);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Request cancelled'));
      this.pendingRequests.delete(key);
      return true;
    }
    return false;
  }

  async getStats(): Promise<DeduplicationStats> {
    const totalRequests = this.stats.totalRequests;
    const deduplicatedRequests = this.stats.deduplicatedRequests;
    const deduplicationRate = totalRequests > 0
      ? (deduplicatedRequests / totalRequests) * 100
      : 0;
    const averageWaitTime = deduplicatedRequests > 0
      ? this.stats.totalWaitTime / deduplicatedRequests
      : 0;

    return {
      totalRequests,
      deduplicatedRequests,
      deduplicationRate,
      averageWaitTime,
      activePendingRequests: this.pendingRequests.size,
    };
  }

  async getPendingRequests(): Promise<Array<{
    key: string;
    requestCount: number;
    age: number;
  }>> {
    const now = Date.now();
    return Array.from(this.pendingRequests.values()).map(request => ({
      key: request.key,
      requestCount: request.requestCount,
      age: now - request.createdAt.getTime(),
    }));
  }

  private cleanupStaleRequests(): void {
    const now = Date.now();
    const maxAge = 30000; // 30 seconds
    let cleaned = 0;

    for (const [key, request] of this.pendingRequests.entries()) {
      const age = now - request.createdAt.getTime();
      if (age > maxAge) {
        clearTimeout(request.timeout);
        request.reject(new Error('Request stale'));
        this.pendingRequests.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.warn(`Cleaned up ${cleaned} stale pending requests`);
    }
  }

  async clear(): Promise<void> {
    for (const request of this.pendingRequests.values()) {
      clearTimeout(request.timeout);
      request.reject(new Error('Service cleared'));
    }
    this.pendingRequests.clear();
    this.logger.log('Request deduplication service cleared');
  }

  async getMetrics(): Promise<{
    pendingRequests: number;
    totalDeduplicated: number;
    averageConcurrentRequests: number;
    peakConcurrentRequests: number;
  }> {
    const pendingRequests = this.pendingRequests.size;
    const totalDeduplicated = this.stats.deduplicatedRequests;
    
    // Calculate average concurrent requests
    const requestCounts = Array.from(this.pendingRequests.values())
      .map(r => r.requestCount);
    const averageConcurrentRequests = requestCounts.length > 0
      ? requestCounts.reduce((sum, count) => sum + count, 0) / requestCounts.length
      : 0;
    const peakConcurrentRequests = requestCounts.length > 0
      ? Math.max(...requestCounts)
      : 0;

    return {
      pendingRequests,
      totalDeduplicated,
      averageConcurrentRequests,
      peakConcurrentRequests,
    };
  }

  async waitForRequest<T>(key: string, timeout: number = 5000): Promise<T | null> {
    const pending = this.pendingRequests.get(key);
    if (!pending) {
      return null;
    }

    return new Promise<T>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new Error(`Timeout waiting for request: ${key}`));
      }, timeout);

      pending.promise
        .then(result => {
          clearTimeout(timeoutHandle);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutHandle);
          reject(error);
        });
    });
  }
}

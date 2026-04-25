import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AsyncLocalStorage } from 'async_hooks';

interface RequestContext {
  requestId: string;
  startTime: number;
  userId?: string;
  traceId?: string;
  metadata?: Record<string, any>;
}

/**
 * Request Context Service
 * Maintains request-scoped context including request ID, user information, and metadata
 * Ensures deterministic error responses with consistent request tracking
 */
@Injectable()
export class RequestContextService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

  /**
   * Initialize context for a new request
   */
  initializeContext(
    requestId?: string,
    userId?: string,
    metadata?: Record<string, any>,
  ): RequestContext {
    const context: RequestContext = {
      requestId: requestId || this.generateRequestId(),
      startTime: Date.now(),
      userId,
      traceId: requestId, // Use requestId as traceId
      metadata,
    };

    this.asyncLocalStorage.enterWith(context);
    return context;
  }

  /**
   * Get current request context
   */
  getContext(): RequestContext | undefined {
    return this.asyncLocalStorage.getStore();
  }

  /**
   * Get current request ID
   */
  getRequestId(): string | undefined {
    return this.asyncLocalStorage.getStore()?.requestId;
  }

  /**
   * Get current user ID
   */
  getUserId(): string | undefined {
    return this.asyncLocalStorage.getStore()?.userId;
  }

  /**
   * Get trace ID (same as request ID)
   */
  getTraceId(): string | undefined {
    return this.asyncLocalStorage.getStore()?.traceId;
  }

  /**
   * Get request start time
   */
  getStartTime(): number | undefined {
    return this.asyncLocalStorage.getStore()?.startTime;
  }

  /**
   * Get request duration in milliseconds
   */
  getDuration(): number {
    const startTime = this.getStartTime();
    return startTime ? Date.now() - startTime : 0;
  }

  /**
   * Get context metadata
   */
  getMetadata(): Record<string, any> | undefined {
    return this.asyncLocalStorage.getStore()?.metadata;
  }

  /**
   * Set or update context metadata
   */
  setMetadata(key: string, value: any): void {
    const context = this.asyncLocalStorage.getStore();
    if (context) {
      if (!context.metadata) {
        context.metadata = {};
      }
      context.metadata[key] = value;
    }
  }

  /**
   * Get metadata value by key
   */
  getMetadataValue(key: string): any | undefined {
    return this.asyncLocalStorage.getStore()?.metadata?.[key];
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${uuidv4().replace(/-/g, '').substring(0, 12)}`;
  }

  /**
   * Clear context (should be called at end of request)
   */
  clearContext(): void {
    const store = this.asyncLocalStorage.getStore();
    if (store) {
      this.asyncLocalStorage.exit();
    }
  }
}

import { Injectable } from '@nestjs/common';

@Injectable()
export class MobileMetricsService {
  private requestCount = 0;
  private cacheHits = 0;
  private totalLatencyMs = 0;
  private routes: Record<string, number> = {};

  record(route: string, latencyMs: number, cacheHit: boolean): void {
    this.requestCount += 1;
    this.totalLatencyMs += latencyMs;
    this.routes[route] = (this.routes[route] ?? 0) + 1;
    if (cacheHit) {
      this.cacheHits += 1;
    }
  }

  summary() {
    return {
      requestCount: this.requestCount,
      cacheHits: this.cacheHits,
      averageLatencyMs:
        this.requestCount === 0 ? 0 : Number((this.totalLatencyMs / this.requestCount).toFixed(2)),
      cacheHitRate:
        this.requestCount === 0 ? 0 : Number((this.cacheHits / this.requestCount).toFixed(4)),
      routes: this.routes,
    };
  }
}

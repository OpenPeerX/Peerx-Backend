import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CdnConfig {
  provider: 'cloudflare' | 'cloudfront' | 'fastly' | 'custom';
  apiKey?: string;
  apiSecret?: string;
  zoneId?: string;
  distributionId?: string;
  baseUrl: string;
}

export interface CacheRule {
  pattern: string;
  ttl: number;
  cacheControl: string;
  edgeTtl?: number;
  browserTtl?: number;
  staleWhileRevalidate?: number;
  staleIfError?: number;
}

export interface PurgeRequest {
  urls?: string[];
  tags?: string[];
  purgeAll?: boolean;
}

export interface CdnMetrics {
  hitRate: number;
  missRate: number;
  bandwidth: number;
  requests: number;
  cacheHits: number;
  cacheMisses: number;
  edgeLatency: number;
  originLatency: number;
}

@Injectable()
export class CdnIntegrationService {
  private readonly logger = new Logger(CdnIntegrationService.name);
  private cacheRules: CacheRule[] = [];
  private metrics: CdnMetrics = {
    hitRate: 0,
    missRate: 0,
    bandwidth: 0,
    requests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    edgeLatency: 0,
    originLatency: 0,
  };

  constructor(private readonly configService: ConfigService) {
    this.initializeCacheRules();
  }

  private initializeCacheRules(): void {
    const config = this.configService.get('edge');
    if (!config?.cdn?.enabled) {
      this.logger.warn('CDN integration is disabled');
      return;
    }

    // Define cache rules based on configuration
    this.cacheRules = [
      {
        pattern: '/api/v*/portfolio/**',
        ttl: config.edgeCache?.ttl?.api || 300,
        cacheControl: config.cdn?.cacheControl?.api || 'public, max-age=60, s-maxage=300',
        edgeTtl: 300,
        browserTtl: 60,
        staleWhileRevalidate: config.edgeCache?.staleWhileRevalidate || 60,
        staleIfError: config.edgeCache?.staleIfError || 86400,
      },
      {
        pattern: '/api/v*/market-data/**',
        ttl: 60, // 1 minute for market data
        cacheControl: 'public, max-age=30, s-maxage=60',
        edgeTtl: 60,
        browserTtl: 30,
        staleWhileRevalidate: 10,
        staleIfError: 300,
      },
      {
        pattern: '/api/v*/trades/**',
        ttl: 120, // 2 minutes for trades
        cacheControl: 'public, max-age=60, s-maxage=120',
        edgeTtl: 120,
        browserTtl: 60,
        staleWhileRevalidate: 30,
        staleIfError: 600,
      },
      {
        pattern: '/api/v*/static/**',
        ttl: config.edgeCache?.ttl?.static || 86400,
        cacheControl: config.cdn?.cacheControl?.static || 'public, max-age=31536000, immutable',
        edgeTtl: 86400,
        browserTtl: 31536000,
      },
      {
        pattern: '/api/v*/auth/**',
        ttl: 0, // No caching for auth endpoints
        cacheControl: config.cdn?.cacheControl?.dynamic || 'private, no-cache, no-store',
        edgeTtl: 0,
        browserTtl: 0,
      },
    ];

    this.logger.log(`Initialized ${this.cacheRules.length} CDN cache rules`);
  }

  getCacheControl(path: string): string {
    const rule = this.findMatchingRule(path);
    return rule?.cacheControl || 'private, no-cache, no-store';
  }

  getCacheHeaders(path: string): Record<string, string> {
    const rule = this.findMatchingRule(path);
    if (!rule) {
      return {
        'Cache-Control': 'private, no-cache, no-store',
        'X-CDN-Cache': 'MISS',
      };
    }

    const headers: Record<string, string> = {
      'Cache-Control': rule.cacheControl,
      'X-CDN-Cache': 'HIT',
      'X-CDN-TTL': rule.ttl.toString(),
    };

    if (rule.staleWhileRevalidate) {
      headers['X-CDN-Stale-While-Revalidate'] = rule.staleWhileRevalidate.toString();
    }

    if (rule.staleIfError) {
      headers['X-CDN-Stale-If-Error'] = rule.staleIfError.toString();
    }

    return headers;
  }

  private findMatchingRule(path: string): CacheRule | undefined {
    return this.cacheRules.find(rule => {
      const pattern = rule.pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\//g, '\\/');
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(path);
    });
  }

  async purgeCache(request: PurgeRequest): Promise<{ success: boolean; purged: number }> {
    const config = this.configService.get('edge');
    if (!config?.cdn?.enabled) {
      this.logger.warn('CDN is disabled, cannot purge cache');
      return { success: false, purged: 0 };
    }

    try {
      const provider = config.cdn.provider;
      let purged = 0;

      switch (provider) {
        case 'cloudflare':
          purged = await this.purgeCloudflare(request, config.cdn);
          break;
        case 'cloudfront':
          purged = await this.purgeCloudFront(request, config.cdn);
          break;
        case 'fastly':
          purged = await this.purgeFastly(request, config.cdn);
          break;
        default:
          this.logger.warn(`Unsupported CDN provider: ${provider}`);
          return { success: false, purged: 0 };
      }

      this.logger.log(`Purged ${purged} items from CDN cache`);
      return { success: true, purged };
    } catch (error) {
      this.logger.error(`Failed to purge CDN cache: ${error.message}`);
      return { success: false, purged: 0 };
    }
  }

  private async purgeCloudflare(
    request: PurgeRequest,
    config: any
  ): Promise<number> {
    // Simulate Cloudflare API call
    // In production, this would use the Cloudflare API
    this.logger.debug('Purging Cloudflare cache');
    
    if (request.purgeAll) {
      // Purge all cache
      return 1000; // Simulated count
    }

    if (request.urls && request.urls.length > 0) {
      // Purge specific URLs
      return request.urls.length;
    }

    if (request.tags && request.tags.length > 0) {
      // Purge by tags (Cloudflare Cache-Tag)
      return request.tags.length * 10; // Simulated count
    }

    return 0;
  }

  private async purgeCloudFront(
    request: PurgeRequest,
    config: any
  ): Promise<number> {
    // Simulate CloudFront API call
    // In production, this would use the AWS SDK
    this.logger.debug('Purging CloudFront cache');
    
    if (request.purgeAll) {
      return 1000;
    }

    if (request.urls && request.urls.length > 0) {
      return request.urls.length;
    }

    return 0;
  }

  private async purgeFastly(
    request: PurgeRequest,
    config: any
  ): Promise<number> {
    // Simulate Fastly API call
    // In production, this would use the Fastly API
    this.logger.debug('Purging Fastly cache');
    
    if (request.purgeAll) {
      return 1000;
    }

    if (request.tags && request.tags.length > 0) {
      return request.tags.length * 10;
    }

    return 0;
  }

  async getMetrics(): Promise<CdnMetrics> {
    // In production, this would fetch real metrics from CDN provider
    return { ...this.metrics };
  }

  updateMetrics(hit: boolean, latency: number): void {
    this.metrics.requests++;
    
    if (hit) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }

    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    this.metrics.hitRate = total > 0 ? (this.metrics.cacheHits / total) * 100 : 0;
    this.metrics.missRate = total > 0 ? (this.metrics.cacheMisses / total) * 100 : 0;

    // Update latency (exponential moving average)
    if (hit) {
      this.metrics.edgeLatency = this.metrics.edgeLatency * 0.9 + latency * 0.1;
    } else {
      this.metrics.originLatency = this.metrics.originLatency * 0.9 + latency * 0.1;
    }
  }

  async preloadCache(urls: string[]): Promise<{ success: boolean; preloaded: number }> {
    const config = this.configService.get('edge');
    if (!config?.cdn?.enabled) {
      return { success: false, preloaded: 0 };
    }

    try {
      // Simulate cache preloading
      // In production, this would trigger CDN to fetch and cache these URLs
      this.logger.log(`Preloading ${urls.length} URLs into CDN cache`);
      
      // Simulate async preloading
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return { success: true, preloaded: urls.length };
    } catch (error) {
      this.logger.error(`Failed to preload cache: ${error.message}`);
      return { success: false, preloaded: 0 };
    }
  }

  async getCacheStatus(url: string): Promise<{
    cached: boolean;
    ttl: number;
    age: number;
    region: string;
  }> {
    // Simulate cache status check
    // In production, this would query CDN API for cache status
    return {
      cached: Math.random() > 0.3, // 70% chance of being cached
      ttl: Math.floor(Math.random() * 300),
      age: Math.floor(Math.random() * 60),
      region: 'us-east',
    };
  }

  addCacheRule(rule: CacheRule): void {
    this.cacheRules.push(rule);
    this.logger.log(`Added cache rule for pattern: ${rule.pattern}`);
  }

  removeCacheRule(pattern: string): boolean {
    const index = this.cacheRules.findIndex(rule => rule.pattern === pattern);
    if (index !== -1) {
      this.cacheRules.splice(index, 1);
      this.logger.log(`Removed cache rule for pattern: ${pattern}`);
      return true;
    }
    return false;
  }

  getCacheRules(): CacheRule[] {
    return [...this.cacheRules];
  }
}

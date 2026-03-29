import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EdgeCacheEntry {
  key: string;
  value: any;
  ttl: number;
  createdAt: Date;
  expiresAt: Date;
  region: string;
  hitCount: number;
  lastAccessed: Date;
  size: number;
  tags: string[];
}

export interface EdgeCacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  averageTtl: number;
  regionDistribution: Record<string, number>;
  topKeys: Array<{ key: string; hits: number; size: number }>;
}

@Injectable()
export class EdgeCacheService {
  private readonly logger = new Logger(EdgeCacheService.name);
  private cache: Map<string, EdgeCacheEntry> = new Map();
  private stats = {
    hits: 0,
    misses: 0,
    totalRequests: 0,
  };

  constructor(private readonly configService: ConfigService) {
    this.startCleanupInterval();
  }

  private startCleanupInterval(): void {
    // Clean up expired entries every minute
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000);
  }

  async get(key: string): Promise<any | null> {
    this.stats.totalRequests++;
    
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (new Date() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access stats
    entry.hitCount++;
    entry.lastAccessed = new Date();
    this.stats.hits++;

    return entry.value;
  }

  async set(
    key: string,
    value: any,
    options: {
      ttl?: number;
      region?: string;
      tags?: string[];
    } = {}
  ): Promise<void> {
    const config = this.configService.get('edge');
    const ttl = options.ttl || config?.edgeCache?.ttl?.api || 300;
    const region = options.region || 'default';
    const tags = options.tags || [];

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttl * 1000);

    const entry: EdgeCacheEntry = {
      key,
      value,
      ttl,
      createdAt: now,
      expiresAt,
      region,
      hitCount: 0,
      lastAccessed: now,
      size: this.calculateSize(value),
      tags,
    };

    this.cache.set(key, entry);
    this.logger.debug(`Cached entry: ${key} (TTL: ${ttl}s, Region: ${region})`);
  }

  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  async deleteByTag(tag: string): Promise<number> {
    let deleted = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.includes(tag)) {
        this.cache.delete(key);
        deleted++;
      }
    }
    this.logger.debug(`Deleted ${deleted} entries with tag: ${tag}`);
    return deleted;
  }

  async deleteByPattern(pattern: string): Promise<number> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    let deleted = 0;
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deleted++;
      }
    }
    
    this.logger.debug(`Deleted ${deleted} entries matching pattern: ${pattern}`);
    return deleted;
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (new Date() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.logger.log('Edge cache cleared');
  }

  async getStats(): Promise<EdgeCacheStats> {
    const entries = Array.from(this.cache.values());
    const totalEntries = entries.length;
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
    const missRate = totalRequests > 0 ? (this.stats.misses / totalRequests) * 100 : 0;
    const averageTtl = entries.length > 0
      ? entries.reduce((sum, entry) => sum + entry.ttl, 0) / entries.length
      : 0;

    // Region distribution
    const regionDistribution: Record<string, number> = {};
    entries.forEach(entry => {
      regionDistribution[entry.region] = (regionDistribution[entry.region] || 0) + 1;
    });

    // Top keys by hit count
    const topKeys = entries
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, 10)
      .map(entry => ({
        key: entry.key,
        hits: entry.hitCount,
        size: entry.size,
      }));

    return {
      totalEntries,
      totalSize,
      hitRate,
      missRate,
      averageTtl,
      regionDistribution,
      topKeys,
    };
  }

  async getEntry(key: string): Promise<EdgeCacheEntry | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (new Date() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry;
  }

  async refresh(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Reset expiration
    const now = new Date();
    entry.expiresAt = new Date(now.getTime() + entry.ttl * 1000);
    entry.lastAccessed = now;
    
    return true;
  }

  async touch(key: string, additionalTtl: number): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Extend expiration
    entry.expiresAt = new Date(entry.expiresAt.getTime() + additionalTtl * 1000);
    entry.lastAccessed = new Date();
    
    return true;
  }

  async getKeysByPattern(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.cache.keys()).filter(key => regex.test(key));
  }

  async getEntriesByTag(tag: string): Promise<EdgeCacheEntry[]> {
    return Array.from(this.cache.values()).filter(entry => 
      entry.tags.includes(tag)
    );
  }

  async preload(entries: Array<{ key: string; value: any; ttl?: number; tags?: string[] }>): Promise<number> {
    let loaded = 0;
    for (const entry of entries) {
      await this.set(entry.key, entry.value, {
        ttl: entry.ttl,
        tags: entry.tags,
      });
      loaded++;
    }
    this.logger.log(`Preloaded ${loaded} entries into edge cache`);
    return loaded;
  }

  private cleanupExpiredEntries(): void {
    const now = new Date();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired cache entries`);
    }
  }

  private calculateSize(value: any): number {
    try {
      return Buffer.byteLength(JSON.stringify(value), 'utf8');
    } catch {
      return 0;
    }
  }

  async getMemoryUsage(): Promise<{
    entries: number;
    totalSize: number;
    averageSize: number;
    largestEntry: { key: string; size: number } | null;
  }> {
    const entries = Array.from(this.cache.values());
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    const averageSize = entries.length > 0 ? totalSize / entries.length : 0;
    
    const largestEntry = entries.length > 0
      ? entries.reduce((largest, entry) => 
          entry.size > largest.size ? entry : largest
        )
      : null;

    return {
      entries: entries.length,
      totalSize,
      averageSize,
      largestEntry: largestEntry ? { key: largestEntry.key, size: largestEntry.size } : null,
    };
  }

  async evictLeastUsed(count: number): Promise<number> {
    const entries = Array.from(this.cache.values())
      .sort((a, b) => a.hitCount - b.hitCount)
      .slice(0, count);

    entries.forEach(entry => this.cache.delete(entry.key));
    
    this.logger.debug(`Evicted ${entries.length} least used cache entries`);
    return entries.length;
  }

  async evictOldest(count: number): Promise<number> {
    const entries = Array.from(this.cache.values())
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, count);

    entries.forEach(entry => this.cache.delete(entry.key));
    
    this.logger.debug(`Evicted ${entries.length} oldest cache entries`);
    return entries.length;
  }
}

import { Injectable } from '@nestjs/common';
import { PricePredictionResponse } from '../interfaces/price-prediction.interfaces';

interface CacheItem {
  value: PricePredictionResponse;
  expiresAt: number;
}

@Injectable()
export class PredictionCacheService {
  private readonly cache = new Map<string, CacheItem>();

  private hits = 0;
  private misses = 0;

  get(key: string): PricePredictionResponse | null {
    const item = this.cache.get(key);
    if (!item || Date.now() > item.expiresAt) {
      if (item) {
        this.cache.delete(key);
      }
      this.misses += 1;
      return null;
    }

    this.hits += 1;
    return item.value;
  }

  set(key: string, value: PricePredictionResponse, ttlMs: number): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  getStats(): { hits: number; misses: number; hitRate: number; entries: number } {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      entries: this.cache.size,
    };
  }
}

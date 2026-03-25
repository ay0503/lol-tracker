/**
 * Simple in-memory cache with TTL and manual invalidation.
 * Used to avoid redundant DB queries for data that only changes
 * when the polling engine runs (every ~2 minutes).
 *
 * Usage:
 *   const data = await cache.getOrSet("player.current", () => fetchFromDB(), 30 * 60 * 1000);
 *   cache.invalidate("player.current");   // after poll writes new data
 *   cache.invalidateAll();                 // clear everything
 */

interface CacheEntry<T = unknown> {
  value: T;
  expiresAt: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry>();

  /** Default TTL: 30 minutes */
  private defaultTTL = 30 * 60 * 1000;

  /**
   * Get a cached value, or compute and store it if missing/expired.
   */
  async getOrSet<T>(key: string, factory: () => T | Promise<T>, ttl?: number): Promise<T> {
    const existing = this.store.get(key);
    if (existing && existing.expiresAt > Date.now()) {
      return existing.value as T;
    }

    const value = await factory();
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttl ?? this.defaultTTL),
    });
    return value;
  }

  /**
   * Get a cached value without computing. Returns undefined if not cached or expired.
   */
  get<T>(key: string): T | undefined {
    const existing = this.store.get(key);
    if (existing && existing.expiresAt > Date.now()) {
      return existing.value as T;
    }
    if (existing) {
      this.store.delete(key);
    }
    return undefined;
  }

  /**
   * Manually set a cache entry.
   */
  set<T>(key: string, value: T, ttl?: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttl ?? this.defaultTTL),
    });
  }

  /**
   * Invalidate a specific cache key.
   */
  invalidate(key: string): void {
    this.store.delete(key);
  }

  /**
   * Invalidate all keys matching a prefix.
   * e.g. invalidatePrefix("prices.") clears prices.latest, prices.etfPrices, prices.etfHistory, etc.
   */
  invalidatePrefix(prefix: string): void {
    const keys = Array.from(this.store.keys());
    for (const key of keys) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Invalidate all cached data. Called after each poll cycle.
   */
  invalidateAll(): void {
    this.store.clear();
  }

  /**
   * Get cache stats for debugging.
   */
  stats(): { size: number; keys: string[] } {
    // Clean expired entries first
    const now = Date.now();
    const entries = Array.from(this.store.entries());
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
    return {
      size: this.store.size,
      keys: Array.from(this.store.keys()),
    };
  }
}

/** Singleton cache instance shared across the server */
export const cache = new MemoryCache();

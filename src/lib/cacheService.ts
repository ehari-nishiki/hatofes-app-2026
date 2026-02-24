interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresIn: number
}

/**
 * Simple localStorage-based caching service for reducing Firestore reads
 * Used to cache frequently accessed but infrequently changing data
 */
export class CacheService {
  /**
   * Store data in cache with expiration
   * @param key - Cache key
   * @param data - Data to cache
   * @param expiresInMs - Expiration time in milliseconds (default: 5 minutes)
   */
  static set<T>(key: string, data: T, expiresInMs: number = 5 * 60 * 1000): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresIn: expiresInMs,
    }
    try {
      localStorage.setItem(`cache_${key}`, JSON.stringify(entry))
    } catch (e) {
      console.warn('Failed to set cache:', e)
      // If localStorage is full, clear old entries
      this.clearExpired()
    }
  }

  /**
   * Retrieve data from cache if not expired
   * @param key - Cache key
   * @returns Cached data or null if expired/not found
   */
  static get<T>(key: string): T | null {
    try {
      const cached = localStorage.getItem(`cache_${key}`)
      if (!cached) return null

      const entry: CacheEntry<T> = JSON.parse(cached)
      const now = Date.now()

      // Check if expired
      if (now - entry.timestamp > entry.expiresIn) {
        localStorage.removeItem(`cache_${key}`)
        return null
      }

      return entry.data
    } catch (e) {
      console.warn('Failed to get cache:', e)
      return null
    }
  }

  /**
   * Clear a specific cache entry or all cache entries
   * @param key - Optional cache key. If not provided, clears all cache
   */
  static clear(key?: string): void {
    if (key) {
      localStorage.removeItem(`cache_${key}`)
    } else {
      // Clear all cache entries
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('cache_')) {
          localStorage.removeItem(k)
        }
      })
    }
  }

  /**
   * Clear only expired cache entries
   */
  static clearExpired(): void {
    const now = Date.now()
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('cache_')) {
        try {
          const entry = JSON.parse(localStorage.getItem(k) || '{}')
          if (now - entry.timestamp > entry.expiresIn) {
            localStorage.removeItem(k)
          }
        } catch (e) {
          // Invalid cache entry, remove it
          localStorage.removeItem(k)
        }
      }
    })
  }

  /**
   * Check if a cache entry exists and is valid
   * @param key - Cache key
   * @returns true if cache exists and is not expired
   */
  static has(key: string): boolean {
    return this.get(key) !== null
  }
}

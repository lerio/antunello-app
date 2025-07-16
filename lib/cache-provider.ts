import { get, set, del, keys, clear } from 'idb-keyval'
import { unstable_serialize } from 'swr'

export interface CacheItem<T = any> {
  data: T
  timestamp: number
  version: number
}

export class PersistentCacheProvider {
  private memoryCache = new Map<string, CacheItem>()
  private readonly CACHE_PREFIX = 'antunello_cache_'
  private readonly CACHE_VERSION = 1
  private readonly DEFAULT_TTL = 24 * 60 * 60 * 1000 // 24 hours

  async get<T>(key: string): Promise<T | undefined> {
    const serializedKey = this.getSerializedKey(key)
    
    // Check memory cache first
    const memoryItem = this.memoryCache.get(serializedKey)
    if (memoryItem && this.isValid(memoryItem)) {
      return memoryItem.data as T
    }

    // Check IndexedDB
    try {
      const item = await get(this.getCacheKey(serializedKey)) as CacheItem<T>
      if (item && this.isValid(item)) {
        // Update memory cache
        this.memoryCache.set(serializedKey, item)
        return item.data
      }
    } catch (error) {
      console.warn('Cache read error:', error)
    }

    return undefined
  }

  async set<T>(key: string, data: T, ttl = this.DEFAULT_TTL): Promise<void> {
    const serializedKey = this.getSerializedKey(key)
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      version: this.CACHE_VERSION
    }

    // Update memory cache
    this.memoryCache.set(serializedKey, item)

    // Update IndexedDB
    try {
      await set(this.getCacheKey(serializedKey), item)
    } catch (error) {
      console.warn('Cache write error:', error)
    }
  }

  async delete(key: string): Promise<void> {
    const serializedKey = this.getSerializedKey(key)
    
    // Remove from memory cache
    this.memoryCache.delete(serializedKey)

    // Remove from IndexedDB
    try {
      await del(this.getCacheKey(serializedKey))
    } catch (error) {
      console.warn('Cache delete error:', error)
    }
  }

  async clear(): Promise<void> {
    // Clear memory cache
    this.memoryCache.clear()

    // Clear IndexedDB
    try {
      const allKeys = await keys()
      const cacheKeys = allKeys.filter(key => 
        typeof key === 'string' && key.startsWith(this.CACHE_PREFIX)
      )
      await Promise.all(cacheKeys.map(key => del(key)))
    } catch (error) {
      console.warn('Cache clear error:', error)
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'))
    
    // Clear from memory cache
    this.memoryCache.forEach((value, key) => {
      if (regex.test(key)) {
        this.memoryCache.delete(key)
      }
    })

    // Clear from IndexedDB
    try {
      const allKeys = await keys()
      const matchingKeys = allKeys.filter(key => 
        typeof key === 'string' && 
        key.startsWith(this.CACHE_PREFIX) &&
        regex.test(key.replace(this.CACHE_PREFIX, ''))
      )
      await Promise.all(matchingKeys.map(key => del(key)))
    } catch (error) {
      console.warn('Cache pattern invalidation error:', error)
    }
  }

  private getSerializedKey(key: string): string {
    return typeof key === 'string' ? key : unstable_serialize(key)
  }

  private getCacheKey(key: string): string {
    return `${this.CACHE_PREFIX}${key}`
  }

  private isValid(item: CacheItem): boolean {
    return (
      item.version === this.CACHE_VERSION &&
      Date.now() - item.timestamp < this.DEFAULT_TTL
    )
  }
}

export const cacheProvider = new PersistentCacheProvider()
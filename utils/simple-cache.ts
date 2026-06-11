/**
 * Simple LRU (Least Recently Used) in-memory cache for transactions.
 *
 * Provides a bounded cache that stores transaction arrays keyed by string keys
 * (e.g., month or year identifiers). Automatically evicts the least recently
 * accessed entry when the cache reaches capacity. Entries have a configurable
 * TTL (time-to-live) and expire after 1 hour.
 *
 * @module utils/simple-cache
 */

import { Transaction } from '@/types/database'

interface CacheEntry {
  data: Transaction[]
  timestamp: number
  accessCount: number
  lastAccessed: number
}

// LRU cache for transactions with 10 month limit
class TransactionCache {
  private readonly cache = new Map<string, CacheEntry>()
  private readonly MAX_ENTRIES = 10
  private readonly TTL = 60 * 60 * 1000 // 1 hour (much longer than before)

  /**
   * Stores a value in the cache under the given key.
   * Removes expired entries first, then evicts the least recently used
   * entry if the cache is at capacity.
   *
   * @param key - The cache key
   * @param data - The transaction array to cache
   */
  set(key: string, data: Transaction[]) {
    // Remove expired entries first
    this.cleanup()

    // If we're at capacity, remove least recently used entry
    if (this.cache.size >= this.MAX_ENTRIES && !this.cache.has(key)) {
      this.evictLRU()
    }

    const now = Date.now()
    this.cache.set(key, {
      data,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now
    })
  }

  /**
   * Retrieves a value from the cache by key.
   * Returns null if the key is not found or the entry has expired.
   * Updates access statistics for LRU tracking on every read.
   *
   * @param key - The cache key to look up
   * @returns The cached transaction array, or null if not found or expired
   */
  get(key: string): Transaction[] | null {
    const entry = this.cache.get(key)
    if (!entry) {
      return null
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key)
      return null
    }

    // Update access statistics for LRU
    entry.accessCount++
    entry.lastAccessed = Date.now()

    return entry.data
  }

  /**
   * Checks whether a key exists in the cache and is not expired.
   *
   * @param key - The cache key to check
   * @returns True if the key exists and has not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    // Check expiration
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  /**
   * Removes all expired entries from the cache.
   */
  private cleanup() {
    const now = Date.now()
    const entries = Array.from(this.cache.entries())
    for (const [key, entry] of entries) {
      if (now - entry.timestamp > this.TTL) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Evicts the entry with the oldest last access time from the cache.
   */
  private evictLRU() {
    let oldestKey: string | null = null
    let oldestTime = Date.now()

    // Find the entry with the oldest last access time
    const entries = Array.from(this.cache.entries())
    for (const [key, entry] of entries) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }

  /**
   * Removes a specific entry from the cache.
   *
   * @param key - The cache key to delete
   */
  delete(key: string) {
    this.cache.delete(key)
  }

  /**
   * Clears all entries from the cache.
   */
  clear() {
    this.cache.clear()
  }

  /**
   * Clear a specific month's cache entry.
   *
   * @param year - The year of the month to clear
   * @param month - The month number (1-12) to clear
   */
  clearMonth(year: number, month: number) {
    const key = `transactions-${year}-${month}`
    this.cache.delete(key)
  }

  /**
   * Clear a specific year's cache entry.
   *
   * @param year - The year to clear
   */
  clearYear(year: number) {
    const key = `year-transactions-${year}`
    this.cache.delete(key)
  }

  /**
   * Clear related cache entries including current month, adjacent months,
   * and affected year caches. Handles year boundaries correctly (e.g., December
   * will also clear January of the next year, and vice versa).
   *
   * @param year - The year of the transaction
   * @param month - The month number (1-12) of the transaction
   */
  clearRelated(year: number, month: number) {
    // Clear current month
    this.clearMonth(year, month)

    // Clear adjacent months
    const prevDate = new Date(year, month - 2, 1)
    const nextDate = new Date(year, month, 1)
    this.clearMonth(prevDate.getFullYear(), prevDate.getMonth() + 1)
    this.clearMonth(nextDate.getFullYear(), nextDate.getMonth() + 1)

    // Clear year cache(s) - handles year boundaries
    this.clearYear(year)
    if (prevDate.getFullYear() !== year) {
      this.clearYear(prevDate.getFullYear())
    }
    if (nextDate.getFullYear() !== year) {
      this.clearYear(nextDate.getFullYear())
    }
  }

  // Debug method to see cache status
  /**
   * Returns a debug snapshot of the cache's current state.
   *
   * @returns An object with cache size, max size, and list of current keys
   */
  getStatus() {
    return {
      size: this.cache.size,
      maxSize: this.MAX_ENTRIES,
      entries: Array.from(this.cache.keys())
    }
  }
}

/**
 * Singleton instance of the LRU transaction cache.
 */
export const transactionCache = new TransactionCache()

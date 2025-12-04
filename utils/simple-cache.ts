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

  private cleanup() {
    const now = Date.now()
    const entries = Array.from(this.cache.entries())
    for (const [key, entry] of entries) {
      if (now - entry.timestamp > this.TTL) {
        this.cache.delete(key)
      }
    }
  }

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

  delete(key: string) {
    this.cache.delete(key)
  }

  clear() {
    this.cache.clear()
  }

  /**
   * Clear a specific month's cache entry
   */
  clearMonth(year: number, month: number) {
    const key = `transactions-${year}-${month}`
    this.cache.delete(key)
  }

  /**
   * Clear a specific year's cache entry
   */
  clearYear(year: number) {
    const key = `year-transactions-${year}`
    this.cache.delete(key)
  }

  /**
   * Clear related cache entries (current + adjacent months + years)
   * Handles year boundaries correctly
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
  getStatus() {
    return {
      size: this.cache.size,
      maxSize: this.MAX_ENTRIES,
      entries: Array.from(this.cache.keys())
    }
  }
}

export const transactionCache = new TransactionCache()
import { Transaction } from '@/types/database'

const CACHE_KEY = 'antunello-swr-cache'
const CACHE_VERSION = '1.0'
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours

interface CachedData {
  version: string
  timestamp: number
  data: Record<string, any>
}

interface SerializedCacheEntry {
  data: any
  timestamp: number
  isValidating?: boolean
}

/**
 * Save SWR cache to localStorage
 */
export function saveCacheToStorage(cache: Map<string, any>) {
  if (typeof globalThis.localStorage === 'undefined') return

  try {
    const serializedCache: Record<string, SerializedCacheEntry> = {}
    
    // Only save transaction-related cache entries
    for (const [key, value] of Array.from(cache.entries())) {
      if (key.startsWith('transactions-') || key.startsWith('transaction-')) {
        serializedCache[key] = {
          data: value,
          timestamp: Date.now(),
          isValidating: false
        }
      }
    }

    const cachedData: CachedData = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      data: serializedCache
    }

    localStorage.setItem(CACHE_KEY, JSON.stringify(cachedData))
  } catch (error) {
    console.warn('Failed to save cache to localStorage:', error)
  }
}

/**
 * Load SWR cache from localStorage
 */
export function loadCacheFromStorage(): Map<string, any> | null {
  if (typeof globalThis.localStorage === 'undefined') return null

  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return null

    const cachedData: CachedData = JSON.parse(cached)
    
    // Check version and expiry
    if (cachedData.version !== CACHE_VERSION) {
      localStorage.removeItem(CACHE_KEY)
      return null
    }

    if (Date.now() - cachedData.timestamp > CACHE_EXPIRY_MS) {
      localStorage.removeItem(CACHE_KEY)
      return null
    }

    // Restore cache
    const cache = new Map<string, any>()
    for (const [key, entry] of Object.entries(cachedData.data)) {
      // Only restore if data is not too old (6 hours for transactions)
      const dataAge = Date.now() - entry.timestamp
      const maxAge = key.startsWith('transactions-') ? 6 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000
      
      if (dataAge < maxAge && (entry as any).data) {
        cache.set(key, (entry as any).data)
      }
    }

    return cache
  } catch (error) {
    console.warn('Failed to load cache from localStorage:', error)
    localStorage.removeItem(CACHE_KEY)
    return null
  }
}

/**
 * Clear cached data from localStorage
 */
export function clearCacheStorage() {
  if (typeof globalThis.localStorage === 'undefined') return
  
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch (error) {
    console.warn('Failed to clear cache storage:', error)
  }
}

/**
 * Get cache storage usage info
 */
export function getCacheStorageInfo() {
  if (typeof globalThis.localStorage === 'undefined') return null

  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return null

    const size = new Blob([cached]).size
    const cachedData: CachedData = JSON.parse(cached)
    
    return {
      version: cachedData.version,
      timestamp: cachedData.timestamp,
      age: Date.now() - cachedData.timestamp,
      size: size,
      entries: Object.keys(cachedData.data).length
    }
  } catch (error) {
    console.warn('Failed to get cache storage info:', error)
    return null
  }
}

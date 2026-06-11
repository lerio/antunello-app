/**
 * @file Manages the serialisation, deserialisation, and lifecycle of the
 * SWR cache to/from localStorage. Supports version-checking, time-based
 * expiry, and age-gated restoration so that stale data is automatically
 * evicted. Also provides an info helper for debugging cache state.
 */

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
 * Save SWR cache to localStorage.
 * Only transaction-related cache entries (keys starting with
 * `transactions-` or `transaction-`) are persisted.
 *
 * @param cache - The SWR cache map to serialise and store.
 */
export function saveCacheToStorage(cache: Map<string, any>) {
  if (globalThis.localStorage === undefined) return

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
 * Load SWR cache from localStorage.
 * Validates the cache version and expiry; stale or mismatched caches are
 * silently removed. Individual entries are further age-gated by key prefix.
 *
 * @returns A hydrated `Map` if a valid persisted cache exists, or `null`
 *          otherwise.
 */
export function loadCacheFromStorage(): Map<string, any> | null {
  if (globalThis.localStorage === undefined) return null

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
      const dataAge = Date.now() - (entry as SerializedCacheEntry).timestamp
      const maxAge = key.startsWith('transactions-') ? 6 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000

      if (dataAge < maxAge && (entry as SerializedCacheEntry).data) {
        cache.set(key, (entry as SerializedCacheEntry).data)
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
 * Clear cached data from localStorage by removing the known cache key.
 */
export function clearCacheStorage() {
  if (globalThis.localStorage === undefined) return

  try {
    localStorage.removeItem(CACHE_KEY)
  } catch (error) {
    console.warn('Failed to clear cache storage:', error)
  }
}

/**
 * Get cache storage usage info.
 *
 * @returns An object describing the cached payload (version, age, byte size,
 *          entry count), or `null` if nothing is cached or an error occurs.
 */
export function getCacheStorageInfo() {
  if (globalThis.localStorage === undefined) return null

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

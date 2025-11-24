import { SWRConfiguration } from 'swr'
import { saveCacheToStorage, loadCacheFromStorage } from './cache-persistence'
import { debouncedSave, setupPeriodicSave } from './cache-debouncer'

// Global cache reference for saving
let globalCache: Map<string, any> | null = null

export const getSwrConfig = (): SWRConfiguration => {
  const baseConfig: SWRConfiguration = {
    // Optimized revalidation settings for faster perceived performance
    revalidateOnFocus: false,
    revalidateOnReconnect: true,

    // Smart retry settings
    errorRetryCount: 2, // Reduced for faster failure detection
    errorRetryInterval: 500, // Faster retry

    // Performance optimizations
    dedupingInterval: 10000, // Reduced to 10 seconds for more responsive updates
    focusThrottleInterval: 30000, // Reduced to 30 seconds

    // Keep previous data during revalidation for better UX
    keepPreviousData: true,

    // Faster loading states
    loadingTimeout: 1000, // Show loading faster
    suspense: false, // Avoid suspense overhead
  }

  return baseConfig
}

export const getClientSwrConfig = (): SWRConfiguration => {
  const baseConfig = getSwrConfig()

  // Only add client-side features when in browser
  if (typeof window !== 'undefined' && globalThis.localStorage !== undefined) {
    return {
      ...baseConfig,

      // Cache persistence configuration
      provider: () => {
        // Initialize with empty cache to avoid blocking main thread
        // Cache will be hydrated asynchronously
        const newCache = new Map()
        globalCache = newCache

        // Hydrate cache asynchronously
        setTimeout(() => {
          const persistedCache = loadCacheFromStorage()
          if (persistedCache && globalCache) {
            console.log('Hydrating cache asynchronously with', persistedCache.size, 'entries')
            for (const [key, value] of Array.from(persistedCache.entries())) {
              globalCache.set(key, value)
              // Trigger revalidation for hydrated keys if needed
              // mutate(key) - optional, SWR might handle this if we use the cache provider correctly
            }
            // Notify SWR that cache has changed (this is tricky with Map, but SWR polls it)
          }

          // Setup periodic saves
          setupPeriodicSave(() => globalCache && saveCacheToStorage(globalCache))
        }, 0)

        return newCache
      },

      // Save cache to localStorage on changes
      onSuccess: (data, key, config) => {
        // Save cache after successful updates (debounced)
        if ((key.startsWith('transactions-') || key.startsWith('transaction-')) && globalCache) {
          debouncedSave(() => globalCache && saveCacheToStorage(globalCache))
        }
      },

      // Global error handler
      onError: (error: any, key: string) => {
        console.error(`SWR Error for key ${key}:`, error)

        // Optional: Send error to monitoring service
        if (process.env.NODE_ENV === 'production') {
          // Example: sendToErrorService(error, key)
        }
      },
    }
  }

  return baseConfig
}

export const swrConfig = getSwrConfig()
import { SWRConfiguration } from 'swr'
import { saveCacheToStorage, loadCacheFromStorage } from './cache-persistence'
import { debouncedSave, setupPeriodicSave } from './cache-debouncer'

// Global cache reference for saving
let globalCache: Map<string, any> | null = null

export const getSwrConfig = (): SWRConfiguration => {
  const baseConfig: SWRConfiguration = {
    // Optimized revalidation settings for instant app access on iOS Safari
    revalidateOnFocus: false,
    revalidateOnReconnect: false, // Disabled to prevent hanging on iOS Safari tab wake
    // revalidateOnMount is left as default (true) to ensure data loads on first mount

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
        // Load cache synchronously for instant access (iOS Safari optimization)
        const persistedCache = loadCacheFromStorage()
        const newCache = persistedCache || new Map()
        globalCache = newCache

        if (persistedCache) {
          console.log('Cache hydrated synchronously with', persistedCache.size, 'entries')
        }

        // Setup periodic saves
        setupPeriodicSave(() => globalCache && saveCacheToStorage(globalCache))

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
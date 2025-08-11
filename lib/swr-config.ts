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
    revalidateOnMount: false, // Don't revalidate on mount to use prefetched data
    
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

  // Only add client-side features when in browser
  if (typeof window !== 'undefined') {
    return {
      ...baseConfig,
      
      // Cache persistence configuration
      provider: () => {
        // Initialize cache from localStorage on startup
        const persistedCache = loadCacheFromStorage()
        if (persistedCache) {
          console.log('Loaded persisted cache with', persistedCache.size, 'entries')
          globalCache = persistedCache
          
          // Setup periodic saves for this cache instance
          setTimeout(() => {
            setupPeriodicSave(() => globalCache && saveCacheToStorage(globalCache))
          }, 1000) // Setup after initial load
          
          return persistedCache
        }
        
        const newCache = new Map()
        globalCache = newCache
        // Setup periodic saves for new cache
        setTimeout(() => {
          setupPeriodicSave(() => globalCache && saveCacheToStorage(globalCache))
        }, 1000)
        
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
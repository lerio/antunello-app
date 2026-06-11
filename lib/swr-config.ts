/**
 * @file Defines the global SWR configuration for the application, including
 * revalidation policies, retry logic, deduplication intervals, and cache
 * persistence integration (localStorage). Provides separate configs for
 * server-side and client-side usage.
 */

import { SWRConfiguration } from 'swr'
import { saveCacheToStorage, loadCacheFromStorage } from './cache-persistence'
import { debouncedSave, setupPeriodicSave } from './cache-debouncer'

// Global cache reference for saving
let globalCache: Map<string, any> | null = null

/**
 * Returns the base SWR configuration suitable for both server and client
 * environments. Covers revalidation, retry, deduplication, and loading
 * behaviour.
 *
 * @returns An {@link SWRConfiguration} object with the application's
 *          performance-optimised defaults.
 */
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

/**
 * Returns the client-side SWR configuration that extends the base config
 * with localStorage cache hydratation and persistence, periodic saves, and
 * global error handling.
 *
 * Only activates the persistence layer when running in a browser environment
 * with localStorage available.
 *
 * @returns An {@link SWRConfiguration} object enhanced with client-side
 *          cache persistence features.
 */
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

/**
 * Application-wide SWR configuration (server-safe, without client-side
 * persistence). Prefer {@link getClientSwrConfig} when running in the
 * browser.
 */
export const swrConfig = getSwrConfig()

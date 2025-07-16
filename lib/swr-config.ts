import { SWRConfiguration } from 'swr'
import { cacheProvider } from './cache-provider'

export const swrConfig: SWRConfiguration = {
  // Custom cache provider with persistent storage
  provider: () => {
    const cache = new Map()
    
    return {
      get: (key: string) => {
        const cached = cache.get(key)
        if (cached) return cached
        
        // Load from persistent cache asynchronously
        cacheProvider.get(key).then(data => {
          if (data) {
            cache.set(key, data)
          }
        })
        
        return cache.get(key)
      },
      
      set: (key: string, data: any) => {
        cache.set(key, data)
        // Persist to IndexedDB
        cacheProvider.set(key, data).catch(console.warn)
      },
      
      delete: (key: string) => {
        cache.delete(key)
        cacheProvider.delete(key).catch(console.warn)
      },
      
      keys: () => cache.keys(),
      
      clear: () => {
        cache.clear()
        cacheProvider.clear().catch(console.warn)
      }
    }
  },
  
  // Revalidation settings
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  revalidateOnMount: true,
  
  // Retry settings
  errorRetryCount: 3,
  errorRetryInterval: 1000,
  
  // Deduplication
  dedupingInterval: 2000,
  
  // Keep previous data during revalidation
  keepPreviousData: true,
  
  // Global error handler
  onError: (error, key) => {
    console.error(`SWR Error for key ${key}:`, error)
  },
  
  // Load from cache on mount
  onSuccess: (data, key) => {
    cacheProvider.set(key, data).catch(console.warn)
  }
}
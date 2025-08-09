import { SWRConfiguration } from 'swr'

export const swrConfig: SWRConfiguration = {
  // Optimized revalidation settings for faster perceived performance
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  revalidateOnMount: true,
  
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
  
  // Global error handler (client-side only)
  ...(typeof window !== 'undefined' && {
    onError: (error: any, key: string) => {
      console.error(`SWR Error for key ${key}:`, error)
      
      // Optional: Send error to monitoring service
      if (process.env.NODE_ENV === 'production') {
        // Example: sendToErrorService(error, key)
      }
    },
  }),
}
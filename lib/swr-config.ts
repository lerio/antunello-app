import { SWRConfiguration } from 'swr'

export const swrConfig: SWRConfiguration = {
  // Optimized revalidation settings
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  revalidateOnMount: true,
  
  // Smart retry settings
  errorRetryCount: 3,
  errorRetryInterval: 1000,
  
  // Performance optimizations
  dedupingInterval: 30000, // 30 seconds
  focusThrottleInterval: 60000, // 1 minute
  
  // Keep previous data during revalidation for better UX
  keepPreviousData: true,
  
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
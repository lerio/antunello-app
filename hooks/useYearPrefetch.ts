import { useCallback, useRef } from 'react'
import { yearTransactionFetcher, createYearKey } from '@/utils/year-fetcher'
import { transactionCache } from '@/utils/simple-cache'

// Track prefetch requests to avoid duplicates
const yearPrefetchQueue = new Set<string>()

export function useYearPrefetch() {
  const prefetchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  const prefetchYear = useCallback(async (year: number) => {
    const yearKey = createYearKey(year)
    
    // Skip if already in cache or being prefetched
    if (transactionCache.has(yearKey) || yearPrefetchQueue.has(yearKey)) {
      return
    }

    yearPrefetchQueue.add(yearKey)

    try {
      await yearTransactionFetcher(yearKey)
    } catch (error) {
      console.warn(`Failed to prefetch ${yearKey}:`, error)
    } finally {
      yearPrefetchQueue.delete(yearKey)
    }
  }, [])

  const prefetchAdjacentYears = useCallback((currentYear: number) => {
    // Calculate previous and next years
    const prevYear = currentYear - 1
    const nextYear = currentYear + 1

    // Clear any existing timeout
    if (prefetchTimeoutRef.current) {
      clearTimeout(prefetchTimeoutRef.current)
    }

    // Debounce prefetching to avoid excessive requests
    prefetchTimeoutRef.current = setTimeout(() => {
      prefetchYear(prevYear)
      prefetchYear(nextYear)
    }, 500)
  }, [prefetchYear])

  return {
    prefetchAdjacentYears,
    prefetchYear,
  }
}
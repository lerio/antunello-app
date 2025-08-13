import { useCallback, useRef } from 'react'
import { transactionFetcher, createMonthKey } from '@/utils/transaction-fetcher'
import { transactionCache } from '@/utils/simple-cache'

// Track prefetch requests to avoid duplicates
const prefetchQueue = new Set<string>()

export function usePrefetch() {
  const prefetchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  const prefetchMonth = useCallback(async (year: number, month: number) => {
    const monthKey = createMonthKey(year, month)
    
    // Skip if already in cache or being prefetched
    if (transactionCache.has(monthKey) || prefetchQueue.has(monthKey)) {
      return
    }

    prefetchQueue.add(monthKey)

    try {
      await transactionFetcher(monthKey)
    } catch (error) {
      console.warn(`Failed to prefetch ${monthKey}:`, error)
    } finally {
      prefetchQueue.delete(monthKey)
    }
  }, [])

  const prefetchAdjacentMonths = useCallback((currentYear: number, currentMonth: number) => {
    // Calculate previous and next months
    const prevDate = new Date(currentYear, currentMonth - 2, 1)
    const nextDate = new Date(currentYear, currentMonth, 1)
    
    const prevYear = prevDate.getFullYear()
    const prevMonth = prevDate.getMonth() + 1
    const nextYear = nextDate.getFullYear()
    const nextMonth = nextDate.getMonth() + 1

    // Clear any existing timeout
    if (prefetchTimeoutRef.current) {
      clearTimeout(prefetchTimeoutRef.current)
    }

    // Debounce prefetching to avoid excessive requests
    prefetchTimeoutRef.current = setTimeout(() => {
      prefetchMonth(prevYear, prevMonth)
      prefetchMonth(nextYear, nextMonth)
    }, 500)
  }, [prefetchMonth])

  return {
    prefetchAdjacentMonths,
  }
}
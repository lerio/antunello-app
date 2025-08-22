import useSWR from 'swr'
import { useEffect } from 'react'
import { Transaction } from '@/types/database'
import { yearTransactionFetcher, createYearKey } from '@/utils/year-fetcher'
import { transactionCache } from '@/utils/simple-cache'
import { useYearPrefetch } from './useYearPrefetch'

export function useYearTransactions(year: number) {
  const { prefetchAdjacentYears } = useYearPrefetch()
  const yearKey = createYearKey(year)

  const { 
    data: transactions, 
    error, 
    isLoading,
    mutate
  } = useSWR<Transaction[]>(yearKey, yearTransactionFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 30000, // 30 seconds
    focusThrottleInterval: 60000, // 1 minute
    keepPreviousData: true,
    refreshInterval: 0,
    // Use cache as fallback data to prevent loading states
    fallbackData: transactionCache.get(yearKey) || undefined,
  })

  // Intelligent prefetching of adjacent years
  useEffect(() => {
    // Only prefetch after the current year data has loaded or is cached
    if (!isLoading && !error) {
      prefetchAdjacentYears(year)
    }
  }, [year, isLoading, error, prefetchAdjacentYears])

  return {
    transactions: transactions || [],
    error,
    isLoading,
    mutate,
    refresh: () => mutate(),
  }
}
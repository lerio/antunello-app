import useSWR from 'swr'
import { Transaction } from '@/types/database'
import { yearTransactionFetcher, createYearKey } from '@/utils/year-fetcher'
import { transactionCache } from '@/utils/simple-cache'

/**
 * Hook to fetch transactions aggregated by year.
 *
 * Uses SWR with a year-based cache key (e.g., `year-2025`). Fetches all
 * transactions for the given year via the `yearTransactionFetcher`.
 * Disables refetch on focus and reconnect to prevent hanging on iOS Safari
 * tab wake. Adjacent-year prefetching lives on the year page, which is the
 * only view that navigates between years.
 *
 * @param year - The full year to fetch transactions for (e.g., 2025).
 *               If omitted, the hook returns empty data.
 *
 * @returns An object containing:
 *  - `transactions` – Array of `Transaction` objects for the year (empty while loading)
 *  - `error` – Any error that occurred during fetch
 *  - `isLoading` – `true` while the request is in-flight
 *  - `mutate` – SWR mutate function for manual cache updates
 *  - `refresh` – Shorthand for `mutate()`
 */
export function useYearTransactions(year?: number) {
  const yearKey = year ? createYearKey(year) : null

  const {
    data: transactions,
    error,
    isLoading,
    mutate
  } = useSWR<Transaction[]>(yearKey, yearTransactionFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false, // Disabled to prevent hanging on iOS Safari tab wake
    dedupingInterval: 30000, // 30 seconds
    focusThrottleInterval: 60000, // 1 minute
    keepPreviousData: true,
    refreshInterval: 0,
    // Use cache as fallback data to prevent loading states
    fallbackData: yearKey ? transactionCache.get(yearKey) || undefined : undefined,
  })

  return {
    transactions: transactions || [],
    error,
    isLoading,
    mutate,
    refresh: () => mutate(),
  }
}

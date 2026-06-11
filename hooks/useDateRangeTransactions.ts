import useSWR from 'swr'
import { Transaction } from '@/types/database'
import { dateRangeTransactionFetcher, createDateRangeKey } from '@/utils/date-range-fetcher'
import { transactionCache } from '@/utils/simple-cache'

/**
 * Hook to fetch transactions within a specific date range.
 *
 * Constructs a deterministic SWR cache key from the start and end dates so
 * overlapping ranges share the same cache entry. Uses a simple in-memory cache
 * (`transactionCache`) as fallback data to prevent unnecessary loading states
 * when navigating between ranges.
 *
 * @param startDate - ISO date string for the range start (inclusive).
 * @param endDate - ISO date string for the range end (inclusive).
 * @returns An object containing:
 *  - `transactions`: Array of matching `Transaction` objects (defaults to `[]`).
 *  - `error`: Any fetch error, or `undefined`.
 *  - `isLoading`: `true` while the initial fetch is in-flight.
 *  - `mutate`: SWR mutate function for manual cache invalidation.
 *  - `refresh`: Convenience wrapper that calls `mutate()`.
 */
export function useDateRangeTransactions(startDate: string, endDate: string) {
    const key = createDateRangeKey(startDate, endDate)

    const {
        data: transactions,
        error,
        isLoading,
        mutate
    } = useSWR<Transaction[]>(key, dateRangeTransactionFetcher, {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        dedupingInterval: 60000, // 1 minute
        focusThrottleInterval: 300000, // 5 minutes
        keepPreviousData: true,
        refreshInterval: 0,
        // Use cache as fallback data to prevent loading states
        fallbackData: transactionCache.get(key) || undefined,
    })

    return {
        transactions: transactions || [],
        error,
        isLoading,
        mutate,
        refresh: () => mutate(),
    }
}

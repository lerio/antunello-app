import useSWR from 'swr'
import { Transaction } from '@/types/database'
import { createClient } from '@/utils/supabase/client'
import { fetchAllBatches } from '@/utils/supabase/fetch-all'

/**
 * Fetcher that retrieves all transactions for the authenticated user.
 * Uses batched pagination via `fetchAllBatches` to handle large datasets efficiently.
 * Orders results by date descending, then by creation timestamp descending.
 */
const allTransactionsFetcher = async (): Promise<Transaction[]> => {
  const supabase = createClient()

  return fetchAllBatches<Transaction>((from, to) =>
    supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to)
  )
}

/**
 * Hook to fetch all transactions across all time.
 *
 * Uses SWR with a SWR cache key of 'all-transactions'. Returns the full list of
 * transactions ordered by date descending. Useful for global search, CSV export,
 * or any feature that needs the complete transaction dataset rather than a
 * time-windowed subset.
 *
 * @returns An object containing:
 *  - `transactions`: Flat array of all transactions (defaults to `[]`).
 *  - `error`: Any error from SWR, or `undefined`.
 *  - `isLoading`: `true` while the initial fetch is in-flight.
 *  - `mutate`: SWR mutate function for manual cache invalidation.
 *  - `refresh`: Convenience wrapper that calls `mutate()`.
 */
export function useAllTransactions() {
  const {
    data: transactions,
    error,
    isLoading,
    mutate
  } = useSWR<Transaction[]>('all-transactions', allTransactionsFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 60000, // 1 minute
    focusThrottleInterval: 300000, // 5 minutes
    refreshInterval: 0,
  })

  return {
    transactions: transactions || [],
    error,
    isLoading,
    mutate,
    refresh: () => mutate(),
  }
}

import useSWR from 'swr'
import { createClient } from '@/utils/supabase/client'
import { Transaction } from '@/types/database'
import { fetchAllBatches } from '@/utils/supabase/fetch-all'
import { getStartDateForTimeRange, type TimeRange as SharedTimeRange } from '@/utils/time-range'

export type TimeRange = SharedTimeRange

/**
 * Fetcher function that queries transactions for a specific category/subcategory and date range
 */
const categoryTransactionsFetcher = async (
  _key: string,
  timeRange: TimeRange,
  category: string,
  subCategory?: string
): Promise<Transaction[]> => {
  const supabase = createClient()
  const startDate = getStartDateForTimeRange(timeRange)

  // Build query with category and optional subcategory/date filter
  let query = supabase
    .from('transactions')
    .select('*')
    .eq('main_category', category)
    .order('date', { ascending: false })

  // Apply subcategory filter if provided
  if (subCategory) {
    query = query.eq('sub_category', subCategory)
  }

  if (startDate) {
    query = query.gte('date', startDate)
  }

  return fetchAllBatches<Transaction>((from, to) => query.range(from, to))
}

/**
 * Hook to fetch transactions for a specific category/subcategory and time range.
 *
 * Uses separate SWR cache keys per category, subcategory, and time range for
 * optimal caching. When `category` is `null`, the hook short-circuits and returns
 * an empty array without making any network request.
 *
 * @param timeRange - The time window (`"1m"`, `"1y"`, `"5y"`, or `"all"`).
 * @param category - The main category to filter by. Pass `null` to disable the query.
 * @param subCategory - Optional subcategory to further narrow results.
 * @returns An object containing:
 *  - `transactions`: Array of matching `Transaction` objects (defaults to `[]`).
 *  - `error`: Any fetch error, or `undefined`.
 *  - `isLoading`: `true` while the initial fetch is in-flight.
 *  - `mutate`: SWR mutate function for manual cache invalidation.
 *  - `refresh`: Convenience wrapper that calls `mutate()`.
 */
export function useCategoryTransactions(
  timeRange: TimeRange,
  category: string | null,
  subCategory?: string | null
) {
  const cacheKey = category
    ? `category-transactions-${category}-${subCategory || 'all'}-${timeRange}`
    : null

  const {
    data: transactions,
    error,
    isLoading,
    mutate,
  } = useSWR<Transaction[]>(
    cacheKey ? [cacheKey, timeRange, category, subCategory] : null,
    ([_, range, cat, subCat]: [string, TimeRange, string, string | undefined]) =>
      categoryTransactionsFetcher(cacheKey!, range, cat, subCat || undefined),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60000, // 1 minute
      focusThrottleInterval: 300000, // 5 minutes
      refreshInterval: 0,
    }
  )

  return {
    transactions: transactions || [],
    error,
    isLoading,
    mutate,
    refresh: () => mutate(),
  }
}

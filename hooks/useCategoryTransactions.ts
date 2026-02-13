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
 * Hook to fetch transactions for a specific category/subcategory and time range
 * Uses separate cache keys per category, subcategory, and time range for optimal performance
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

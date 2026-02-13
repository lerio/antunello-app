import useSWR from 'swr'
import { Transaction } from '@/types/database'
import { createClient } from '@/utils/supabase/client'
import { fetchAllBatches } from '@/utils/supabase/fetch-all'
import { getStartDateForTimeRange, type TimeRange as SharedTimeRange } from '@/utils/time-range'

export type TimeRange = SharedTimeRange
export type BalanceTransaction = {
  date: string
  type: 'expense' | 'income'
  eur_amount: number | null
  hide_from_totals: boolean | null
  is_money_transfer: boolean | null
}

/**
 * Fetcher function that queries transactions within a specific date range
 */
const rangeTransactionsFetcher = async (
  _key: string,
  timeRange: TimeRange
): Promise<BalanceTransaction[]> => {
  const supabase = createClient()
  const startDate = getStartDateForTimeRange(timeRange)

  // Build query with optional date filter
  // Only select fields needed for balance calculation (75% payload reduction)
  let query = supabase
    .from('transactions')
    .select('date, type, eur_amount, hide_from_totals, is_money_transfer')
    .order('date', { ascending: true }) // Chronological order for balance calculation

  if (startDate) {
    query = query.gte('date', startDate)
  }

  return fetchAllBatches<BalanceTransaction>((from, to) => query.range(from, to))
}

/**
 * Hook to fetch transactions for a specific time range
 * Uses separate cache keys per time range and hidden state for optimal performance
 */
export function useRangeTransactions(
  timeRange: TimeRange,
  includeHidden: boolean
) {
  const cacheKey = `balance-transactions-${timeRange}-${includeHidden}`

  const {
    data: transactions,
    error,
    isLoading,
    mutate,
  } = useSWR<BalanceTransaction[]>(
    [cacheKey, timeRange],
    ([_, range]: [string, TimeRange]) => rangeTransactionsFetcher(cacheKey, range),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60000,
      focusThrottleInterval: 300000,
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

import useSWR from 'swr'
import { Transaction } from '@/types/database'
import { createClient } from '@/utils/supabase/client'
import { fetchAllBatches } from '@/utils/supabase/fetch-all'
import { getStartDateForTimeRange, type TimeRange as SharedTimeRange } from '@/utils/time-range'
import { expandSplitTransactionsForYear } from '@/utils/split-transactions'

export type TimeRange = SharedTimeRange
export type BalanceTransaction = {
  date: string
  type: 'expense' | 'income'
  eur_amount: number | null
  split_display_eur_amount?: number | null
  split_across_year?: boolean
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
  const now = new Date()
  const nowIso = now.toISOString()

  // Build query with optional date filter
  // Keep selection lightweight while including fields needed for split expansion.
  let query = supabase
    .from('transactions')
    .select('id, user_id, amount, currency, type, main_category, title, date, created_at, updated_at, eur_amount, hide_from_totals, is_money_transfer, split_across_year')
    .order('date', { ascending: true }) // Chronological order for balance calculation

  if (startDate) {
    query = query.gte('date', startDate)
  }

  const baseTransactions = await fetchAllBatches<Transaction>((from, to) =>
    query.range(from, to)
  )

  const regularTransactions = baseTransactions.filter((t) => !t.split_across_year)
  const splitExpandedInRange: Transaction[] = []

  // For bounded ranges, fetch split sources for all years spanned by the range
  // so per-month split instances are included even when the original source date
  // is outside the range window.
  const rangeStartYear = startDate ? new Date(startDate).getUTCFullYear() : null
  const rangeEndYear = now.getUTCFullYear()
  if (rangeStartYear !== null && rangeStartYear <= rangeEndYear) {
    const yearStart = `${rangeStartYear}-01-01T00:00:00.000Z`
    const yearEndExclusive = `${rangeEndYear + 1}-01-01T00:00:00.000Z`

    const splitSources = await fetchAllBatches<Transaction>((from, to) =>
      supabase
        .from('transactions')
        .select('id, user_id, amount, currency, type, main_category, title, date, created_at, updated_at, eur_amount, hide_from_totals, is_money_transfer, split_across_year')
        .eq('split_across_year', true)
        .gte('date', yearStart)
        .lt('date', yearEndExclusive)
        .order('date', { ascending: true })
        .range(from, to)
    )

    const byYear = new Map<number, Transaction[]>()
    for (const tx of splitSources) {
      const y = new Date(tx.date).getUTCFullYear()
      if (!byYear.has(y)) byYear.set(y, [])
      byYear.get(y)!.push(tx)
    }

    for (let y = rangeStartYear; y <= rangeEndYear; y += 1) {
      const yearSplitSources = byYear.get(y) || []
      if (yearSplitSources.length === 0) continue
      const expanded = expandSplitTransactionsForYear(yearSplitSources, y, now)
      splitExpandedInRange.push(
        ...expanded.filter((tx) => {
          const txTime = new Date(tx.date).getTime()
          const lowerBound = startDate ? new Date(startDate).getTime() : Number.NEGATIVE_INFINITY
          const upperBound = new Date(nowIso).getTime()
          return txTime >= lowerBound && txTime <= upperBound
        })
      )
    }
  } else {
    // "all" range: base query already contains all transactions, expand split rows in-place.
    const splitSources = baseTransactions.filter((t) => t.split_across_year)
    const byYear = new Map<number, Transaction[]>()
    for (const tx of splitSources) {
      const y = new Date(tx.date).getUTCFullYear()
      if (!byYear.has(y)) byYear.set(y, [])
      byYear.get(y)!.push(tx)
    }
    byYear.forEach((yearSplitSources, y) => {
      splitExpandedInRange.push(...expandSplitTransactionsForYear(yearSplitSources, y, now))
    })
  }

  const combined = [...regularTransactions, ...splitExpandedInRange].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  return combined.map((tx) => ({
    date: tx.date,
    type: tx.type,
    eur_amount: tx.eur_amount ?? null,
    split_display_eur_amount: tx.split_display_eur_amount ?? null,
    split_across_year: tx.split_across_year,
    hide_from_totals: tx.hide_from_totals ?? null,
    is_money_transfer: tx.is_money_transfer ?? null,
  }))
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

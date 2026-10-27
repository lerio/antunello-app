import useSWR from 'swr'
import { useMemo } from 'react'
import { Transaction } from '@/types/database'
import { transactionFetcher, createMonthKey } from '@/utils/transaction-fetcher'
import { transactionCache } from '@/utils/simple-cache'
import { getTransactionDisplayAmount, getTransactionDisplayEurAmount } from '@/utils/split-transactions'

/**
 * Consolidated, optimized hook for fetching and managing monthly transactions.
 *
 * Uses SWR with a month-based cache key (e.g., `transactions-2025-06`). Supports
 * memoized summary calculations (totals grouped by currency). Adjacent-month
 * prefetching lives on the transactions page, which is the only view that
 * navigates between months.
 *
 * @param year  - The year to fetch transactions for (e.g., 2025).
 * @param month - The month number (1-12).
 *
 * @returns An object containing:
 *  - `transactions` – Array of `Transaction` objects for the given month (empty while loading)
 *  - `summary` – A memoized summary `{ totals, netTotal }` or `null` if no transactions exist
 *  - `isLoading` – `true` while the request is in-flight
 *  - `error` – Any error that occurred during fetch
 *  - `mutate` – SWR mutate function for manual cache updates
 *  - `refresh` – Shorthand for `mutate()`
 */
export function useTransactionsOptimized(year: number, month: number) {
  const monthKey = createMonthKey(year, month)

  const {
    data: transactions,
    error,
    mutate,
    isLoading
  } = useSWR<Transaction[]>(monthKey, transactionFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false, // Disabled to prevent hanging on iOS Safari tab wake
    dedupingInterval: 10000,
    focusThrottleInterval: 30000,
    keepPreviousData: true,
    refreshInterval: 0,
    // Use cache as fallback data to prevent loading states
    fallbackData: transactionCache.get(monthKey) || undefined,
  })

  // Real-time subscriptions removed for iOS Safari optimization
  // Updates will be detected via background polling (see useBackgroundSync hook)

  // Memoized summary calculations
  const summary = useMemo(() => {
    if (!transactions?.length) return null

    const totals = transactions.reduce((acc, t) => {
      // Skip transactions that are hidden from totals
      if (t.hide_from_totals) return acc

      const currency = t.currency
      if (!acc[currency]) acc[currency] = { income: 0, expense: 0, count: 0 }

      const amount = getTransactionDisplayEurAmount(t) ?? getTransactionDisplayAmount(t)
      acc[currency][t.type] += amount
      acc[currency].count += 1

      return acc
    }, {} as Record<string, { income: number; expense: number; count: number }>)

    // Calculate net total in EUR
    const netTotal = Object.values(totals).reduce((sum, curr) =>
      sum + curr.income - curr.expense, 0
    )

    return { totals, netTotal }
  }, [transactions])

  return {
    transactions: transactions || [],
    summary,
    isLoading,
    error,
    mutate,
    // Simplified interface
    refresh: () => mutate(),
  }
}

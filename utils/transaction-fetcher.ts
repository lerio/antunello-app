/**
 * Monthly transaction fetcher utility.
 *
 * Provides a shared fetcher function for retrieving all transactions within
 * a given month. Includes LRU caching, in-flight request deduplication,
 * expansion of split-across-year transactions into the target month, and
 * compatibility with SWR data fetching hooks.
 *
 * @module utils/transaction-fetcher
 */

import { createClient } from '@/utils/supabase/client'
import { Transaction } from '@/types/database'
import { transactionCache } from './simple-cache'
import { expandSplitTransactionsForMonth } from './split-transactions'
import { sortTransactionsByDateInPlace } from './transaction-utils'

// Track in-flight requests to avoid duplicate fetches
const inflightRequests = new Map<string, Promise<Transaction[]>>()

/**
 * Shared transaction fetcher to ensure prefetch and hooks use the same function.
 * Checks the LRU cache first, deduplicates in-flight requests, and fetches
 * from Supabase with split-across-year expansion.
 *
 * @param key - The cache key in the format "transactions-{year}-{month}"
 * @returns A promise resolving to a sorted array of transactions for the month
 * @throws {Error} If the Supabase query fails (excluding split_across_year column missing errors)
 */
export const transactionFetcher = async (key: string): Promise<Transaction[]> => {
  // Check cache first (fast path)
  const cached = transactionCache.get(key)
  if (cached) {
    return cached
  }

  // Check if we're already fetching this key
  if (inflightRequests.has(key)) {
    return inflightRequests.get(key)!
  }

  // Create the fetch promise
  const fetchPromise = fetchTransactions(key)
  inflightRequests.set(key, fetchPromise)

  try {
    const transactions = await fetchPromise
    transactionCache.set(key, transactions)
    return transactions
  } finally {
    inflightRequests.delete(key)
  }
}

/**
 * Fetches transactions from Supabase for a given month and expands any
 * split-across-year transactions into instances within that month.
 *
 * @param key - The cache key containing the target year and month
 * @returns A sorted array of transactions for the month, including expanded split instances
 * @throws {Error} If the main Supabase query fails
 */
async function fetchTransactions(key: string): Promise<Transaction[]> {
  const [, targetYear, targetMonth] = key.split('-').map(Number)

  const start = new Date(targetYear, targetMonth - 1, 1)
  const end = new Date(targetYear, targetMonth, 0, 23, 59, 59)

  const supabase = createClient()
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .gte('date', start.toISOString())
    .lte('date', end.toISOString())
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(0, 9999) // Get up to 10,000 transactions to avoid the 1000 limit

  if (error) throw error

  const monthTransactions = data || []

  const yearStart = `${targetYear}-01-01T00:00:00.000Z`
  const yearEnd = `${targetYear}-12-31T23:59:59.999Z`

  const { data: splitData, error: splitError } = await supabase
    .from('transactions')
    .select('*')
    .eq('split_across_year', true)
    .gte('date', yearStart)
    .lte('date', yearEnd)
    .order('date', { ascending: false })
    .range(0, 9999)

  if (splitError) {
    const msg = (splitError.message || '').toLowerCase()
    const errObj = splitError as unknown as Record<string, unknown>
    const code = typeof errObj.code === 'string' ? errObj.code : undefined
    if (code === '42703' || msg.includes('split_across_year')) {
      return monthTransactions
    }
    throw splitError
  }

  return sortTransactionsByDateInPlace(
    expandSplitTransactionsForMonth(
      monthTransactions,
      splitData || [],
      targetYear,
      targetMonth
    )
  )
}

/**
 * Creates a consistent cache/fetch key for a month.
 *
 * @param year - The year (e.g. 2025)
 * @param month - The month number (1-12)
 * @returns The formatted cache key string (e.g. "transactions-2025-8")
 */
export const createMonthKey = (year: number, month: number): string => {
  return `transactions-${year}-${month}`
}

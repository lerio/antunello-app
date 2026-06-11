/**
 * Date range transaction fetcher utility.
 *
 * Provides a shared fetcher function for retrieving transactions within a
 * specified date range. Includes caching via the transaction LRU cache,
 * in-flight request deduplication to avoid redundant network calls, and
 * expansion of split-across-year transactions into the visible range.
 *
 * @module utils/date-range-fetcher
 */

import { createClient } from '@/utils/supabase/client'
import { Transaction } from '@/types/database'
import { transactionCache } from './simple-cache'
import { fetchAllBatches } from './supabase/fetch-all'
import { expandSplitTransactionsForYear } from './split-transactions'
import { sortTransactionsByDateInPlace } from './transaction-utils'

// Track in-flight requests to avoid duplicate fetches
const inflightRangeRequests = new Map<string, Promise<Transaction[]>>()

/**
 * Shared transaction fetcher for date ranges. Checks the LRU cache first,
 * then deduplicates in-flight requests, and finally fetches from Supabase.
 * Handles both regular transactions and split-across-year transaction expansion.
 *
 * @param key - The cache/fetch key in the format "range-transactions-{startDate}:{endDate}"
 * @returns A promise resolving to an array of transactions within the date range
 * @throws {Error} If the key format is invalid or the Supabase query fails
 */
export const dateRangeTransactionFetcher = async (key: string): Promise<Transaction[]> => {
  // Check cache first (fast path)
  const cached = transactionCache.get(key)
  if (cached) {
    return cached
  }

  // Check if we're already fetching this key
  if (inflightRangeRequests.has(key)) {
    return inflightRangeRequests.get(key)!
  }

  // Create the fetch promise
  const fetchPromise = fetchDateRangeTransactions(key)
  inflightRangeRequests.set(key, fetchPromise)

  try {
    const transactions = await fetchPromise
    transactionCache.set(key, transactions)
    return transactions
  } finally {
    inflightRangeRequests.delete(key)
  }
}

/**
 * Fetches transactions from Supabase for the given date range, including
 * expanding any split-across-year transactions that fall within the range.
 *
 * @param key - The cache key containing the start and end dates
 * @returns A sorted array of transactions within the date range
 * @throws {Error} If the key format is invalid
 */
async function fetchDateRangeTransactions(key: string): Promise<Transaction[]> {
  const rangePart = key.replace('range-transactions-', '')
  const [startDate, endDate] = rangePart.split(':')

  if (!startDate || !endDate) {
      throw new Error(`Invalid date range key: ${key}`)
  }

  const supabase = createClient()
  const rangeStart = new Date(`${startDate}T00:00:00.000Z`)
  const rangeEndExclusive = new Date(`${endDate}T00:00:00.000Z`)
  rangeEndExclusive.setUTCDate(rangeEndExclusive.getUTCDate() + 1)

  const rangeStartIso = rangeStart.toISOString()
  const rangeEndExclusiveIso = rangeEndExclusive.toISOString()

  const rangeTransactions = await fetchAllBatches<Transaction>((from, to) =>
    supabase
      .from('transactions')
      .select('*')
      .gte('date', rangeStartIso)
      .lt('date', rangeEndExclusiveIso)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to)
  )

  const regularTransactions = rangeTransactions.filter((t) => !t.split_across_year)

  const startYear = rangeStart.getUTCFullYear()
  const endYear = rangeEndExclusive.getUTCFullYear()
  const splitYearStart = `${startYear}-01-01T00:00:00.000Z`
  const splitYearEndExclusive = `${endYear + 1}-01-01T00:00:00.000Z`

  const splitSources = await fetchAllBatches<Transaction>((from, to) =>
    supabase
      .from('transactions')
      .select('*')
      .eq('split_across_year', true)
      .gte('date', splitYearStart)
      .lt('date', splitYearEndExclusive)
      .order('date', { ascending: false })
      .range(from, to)
  )

  const splitByYear: Record<number, Transaction[]> = {}
  for (const tx of splitSources) {
    const year = new Date(tx.date).getUTCFullYear()
    if (!splitByYear[year]) splitByYear[year] = []
    splitByYear[year].push(tx)
  }

  const expandedSplit: Transaction[] = []
  const now = new Date()
  for (let year = startYear; year <= endYear; year += 1) {
    const yearSplits = splitByYear[year] || []
    if (yearSplits.length === 0) continue
    expandedSplit.push(...expandSplitTransactionsForYear(yearSplits, year, now))
  }

  const rangeStartMs = rangeStart.getTime()
  const rangeEndExclusiveMs = rangeEndExclusive.getTime()

  const splitInRange = expandedSplit.filter((t) => {
    const ts = new Date(t.date).getTime()
    return ts >= rangeStartMs && ts < rangeEndExclusiveMs
  })

  return sortTransactionsByDateInPlace([...regularTransactions, ...splitInRange])
}

/**
 * Creates a consistent cache/fetch key for a date range.
 *
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format (exclusive range end)
 * @returns The formatted cache key string
 */
export const createDateRangeKey = (startDate: string, endDate: string): string => {
    return `range-transactions-${startDate}:${endDate}`
}

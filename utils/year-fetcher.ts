/**
 * Yearly transaction fetcher utility.
 *
 * Provides a shared fetcher function for retrieving all transactions within
 * a given calendar year, with CET-based boundary handling for the year start
 * and end. Includes LRU caching, in-flight request deduplication, batch fetching
 * to avoid Supabase's 1000-row limit, and expansion of split-across-year
 * transactions into monthly instances for the full year view.
 *
 * @module utils/year-fetcher
 */

import { createClient } from '@/utils/supabase/client'
import { Transaction } from '@/types/database'
import { transactionCache } from './simple-cache'
import { fetchAllBatches } from './supabase/fetch-all'
import { expandSplitTransactionsForYear } from './split-transactions'
import { sortTransactionsByDateInPlace } from './transaction-utils'

// Track in-flight requests to avoid duplicate fetches
const inflightYearRequests = new Map<string, Promise<Transaction[]>>()

/**
 * Shared year transaction fetcher to ensure prefetch and hooks use the same function.
 * Checks the LRU cache first, deduplicates in-flight requests, and fetches
 * from Supabase with CET-based year boundaries and split transaction expansion.
 *
 * @param key - The cache key in the format "year-transactions-{year}"
 * @returns A promise resolving to a sorted array of transactions for the year
 * @throws {Error} If the year cannot be parsed from the key or is invalid
 */
export const yearTransactionFetcher = async (key: string): Promise<Transaction[]> => {
  // Check cache first (fast path)
  const cached = transactionCache.get(key)
  if (cached) {
    return cached
  }

  // Check if we're already fetching this key
  if (inflightYearRequests.has(key)) {
    return inflightYearRequests.get(key)!
  }

  // Create the fetch promise
  const fetchPromise = fetchYearTransactions(key)
  inflightYearRequests.set(key, fetchPromise)

  try {
    const transactions = await fetchPromise
    transactionCache.set(key, transactions)
    return transactions
  } finally {
    inflightYearRequests.delete(key)
  }
}

/**
 * Fetches all transactions for a given year from Supabase, using CET-based
 * year boundaries (Jan 1 00:00 CET) and batch fetching to handle large datasets.
 * Expands any split-across-year transactions into their monthly instances.
 *
 * @param key - The cache key containing the target year
 * @returns A sorted array of all transactions in the year, with split instances expanded
 * @throws {Error} If the year cannot be parsed or is out of valid range (1000-9999)
 */
async function fetchYearTransactions(key: string): Promise<Transaction[]> {
  const year = Number.parseInt(key.split('-')[2]) // Extract year from "year-transactions-YYYY"

  // Validate the year
  if (Number.isNaN(year) || year < 1000 || year > 9999) {
    throw new Error(`Invalid year extracted from key: ${key}`)
  }

  // Business rule: yearly boundaries are CET-based (Jan 1st 00:00 CET).
  // 00:00 CET corresponds to 23:00 UTC on the previous day in January.
  const yearStart = new Date(Date.UTC(year, 0, 1, -1, 0, 0, 0)).toISOString()
  const nextYearStart = new Date(Date.UTC(year + 1, 0, 1, -1, 0, 0, 0)).toISOString()

  const supabase = createClient()

  const yearTransactions = await fetchAllBatches<Transaction>((from, to) =>
    supabase
      .from('transactions')
      .select('*')
      .gte('date', yearStart)
      .lt('date', nextYearStart)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to)
  )

  return sortTransactionsByDateInPlace(
    expandSplitTransactionsForYear(yearTransactions, year)
  )
}

/**
 * Creates a consistent cache/fetch key for a year.
 *
 * @param year - The calendar year (e.g. 2025, must be between 1000 and 9999)
 * @returns The formatted cache key string (e.g. "year-transactions-2025")
 * @throws {Error} If the year is NaN or outside the valid range
 */
export const createYearKey = (year: number): string => {
  // Validate the year input
  if (Number.isNaN(year) || year < 1000 || year > 9999) {
    throw new Error(`Invalid year provided: ${year}`)
  }
  return `year-transactions-${year}`
}

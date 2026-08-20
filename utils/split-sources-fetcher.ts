/**
 * Shared split-source fetcher for split-across-year transactions.
 *
 * The month fetcher (transaction-fetcher) and the page/summary hooks all need
 * the same "current year + previous year" split sources (split instances roll
 * across year boundaries). Sharing one fetcher with in-flight dedup + LRU
 * caching avoids duplicate Supabase queries on the transactions page.
 *
 * @module utils/split-sources-fetcher
 */

import { createClient } from '@/utils/supabase/client'
import { Transaction } from '@/types/database'
import { transactionCache } from './simple-cache'

// Track in-flight requests to avoid duplicate fetches
const inflightSplitSourceRequests = new Map<string, Promise<Transaction[]>>()

/**
 * Creates a consistent cache/fetch key for a year's split sources.
 *
 * @param year - The year (e.g. 2025)
 * @returns The formatted cache key string (e.g. "split-sources-2025")
 */
export const createSplitSourcesKey = (year: number): string => {
  return `split-sources-${year}`
}

/**
 * Shared fetcher for split-across-year transactions spanning the given year
 * plus the previous year. Checks the LRU cache first, then deduplicates
 * in-flight requests, and finally fetches from Supabase.
 *
 * @param key - The cache key in the format "split-sources-{year}"
 * @returns A promise resolving to the combined split-source transactions
 */
export const fetchSplitSourcesForYear = async (key: string): Promise<Transaction[]> => {
  // Check cache first (fast path)
  const cached = transactionCache.get(key)
  if (cached) {
    return cached
  }

  // Check if we're already fetching this key
  if (inflightSplitSourceRequests.has(key)) {
    return inflightSplitSourceRequests.get(key)!
  }

  // Create the fetch promise
  const fetchPromise = fetchSplitSources(key)
  inflightSplitSourceRequests.set(key, fetchPromise)

  try {
    const transactions = await fetchPromise
    transactionCache.set(key, transactions)
    return transactions
  } finally {
    inflightSplitSourceRequests.delete(key)
  }
}

/**
 * Queries split-across-year transactions for the given year and the previous
 * year (rolling windows cross year boundaries).
 */
async function fetchSplitSources(key: string): Promise<Transaction[]> {
  const year = Number(key.replace('split-sources-', ''))
  const supabase = createClient()

  const yearStart = `${year}-01-01T00:00:00.000Z`
  const yearEnd = `${year}-12-31T23:59:59.999Z`
  const prevYearStart = `${year - 1}-01-01T00:00:00.000Z`
  const prevYearEnd = `${year - 1}-12-31T23:59:59.999Z`

  const [currentResult, prevResult] = await Promise.all([
    supabase
      .from('transactions')
      .select('*')
      .eq('split_across_year', true)
      .gte('date', yearStart)
      .lte('date', yearEnd)
      .range(0, 9999),
    supabase
      .from('transactions')
      .select('*')
      .eq('split_across_year', true)
      .gte('date', prevYearStart)
      .lte('date', prevYearEnd)
      .range(0, 9999),
  ])

  const error = currentResult.error || prevResult.error
  if (error) {
    const msg = (error.message || '').toLowerCase()
    const code =
      typeof (error as unknown as Record<string, unknown>).code === 'string'
        ? ((error as unknown as Record<string, unknown>).code as string)
        : undefined

    // Degrade gracefully if the split_across_year column is missing
    if (code === '42703' || msg.includes('split_across_year')) {
      return []
    }
    throw error
  }

  return [...(currentResult.data || []), ...(prevResult.data || [])] as Transaction[]
}

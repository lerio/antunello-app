import { createClient } from '@/utils/supabase/client'
import { Transaction } from '@/types/database'
import { transactionCache } from './simple-cache'
import { fetchAllBatches } from './supabase/fetch-all'
import { expandSplitTransactionsForYear } from './split-transactions'
import { sortTransactionsByDateInPlace } from './transaction-utils'

// Track in-flight requests to avoid duplicate fetches
const inflightRangeRequests = new Map<string, Promise<Transaction[]>>()

// Shared transaction fetcher for date ranges
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

export const createDateRangeKey = (startDate: string, endDate: string) => {
    return `range-transactions-${startDate}:${endDate}`
}

import { createClient } from '@/utils/supabase/client'
import { Transaction } from '@/types/database'
import { transactionCache } from './simple-cache'
import { fetchAllBatches } from './supabase/fetch-all'

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

  return fetchAllBatches<Transaction>((from, to) =>
    supabase
      .from('transactions')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to)
  )
}

export const createDateRangeKey = (startDate: string, endDate: string) => {
    return `range-transactions-${startDate}:${endDate}`
}

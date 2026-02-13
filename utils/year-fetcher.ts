import { createClient } from '@/utils/supabase/client'
import { Transaction } from '@/types/database'
import { transactionCache } from './simple-cache'
import { fetchAllBatches } from './supabase/fetch-all'

// Track in-flight requests to avoid duplicate fetches
const inflightYearRequests = new Map<string, Promise<Transaction[]>>()

// Shared year transaction fetcher to ensure prefetch and hooks use the same function
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

async function fetchYearTransactions(key: string): Promise<Transaction[]> {
  const year = Number.parseInt(key.split('-')[2]) // Extract year from "year-transactions-YYYY"
  
  // Validate the year
  if (Number.isNaN(year) || year < 1000 || year > 9999) {
    throw new Error(`Invalid year extracted from key: ${key}`)
  }
  
  const startDate = `${year}-01-01`
  const endDate = `${year}-12-31`

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

// Helper to create year keys consistently
export const createYearKey = (year: number): string => {
  // Validate the year input
  if (Number.isNaN(year) || year < 1000 || year > 9999) {
    throw new Error(`Invalid year provided: ${year}`)
  }
  return `year-transactions-${year}`
}

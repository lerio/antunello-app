import { createClient } from '@/utils/supabase/client'
import { Transaction } from '@/types/database'
import { transactionCache } from './simple-cache'

// Track in-flight requests to avoid duplicate fetches
const inflightRequests = new Map<string, Promise<Transaction[]>>()

// Shared transaction fetcher to ensure prefetch and hooks use the same function
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
    .limit(1000)

  if (error) throw error
  
  return data || []
}

// Helper to create month keys consistently
export const createMonthKey = (year: number, month: number): string => {
  return `transactions-${year}-${month}`
}
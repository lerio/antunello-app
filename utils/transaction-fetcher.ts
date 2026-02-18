import { createClient } from '@/utils/supabase/client'
import { Transaction } from '@/types/database'
import { transactionCache } from './simple-cache'
import { expandSplitTransactionsForMonth } from './split-transactions'
import { sortTransactionsByDateInPlace } from './transaction-utils'

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

// Helper to create month keys consistently
export const createMonthKey = (year: number, month: number): string => {
  return `transactions-${year}-${month}`
}

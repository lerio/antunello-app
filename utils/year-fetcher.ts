import { createClient } from '@/utils/supabase/client'
import { Transaction } from '@/types/database'
import { transactionCache } from './simple-cache'

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
  const year = parseInt(key.split('-')[2]) // Extract year from "year-transactions-YYYY"
  
  const startDate = `${year}-01-01`
  const endDate = `${year}-12-31`

  const supabase = createClient()
  
  // Use pagination to get ALL transactions (bypassing any limits)
  let allTransactions: Transaction[] = []
  let from = 0
  const batchSize = 1000
  
  while (true) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })
      .range(from, from + batchSize - 1)
    
    if (error) throw error
    
    if (!data || data.length === 0) {
      break // No more data
    }
    
    allTransactions = [...allTransactions, ...data]
    
    if (data.length < batchSize) {
      break // We got less than a full batch, so we're done
    }
    
    from += batchSize
  }
  
  return allTransactions
}

// Helper to create year keys consistently
export const createYearKey = (year: number): string => {
  return `year-transactions-${year}`
}
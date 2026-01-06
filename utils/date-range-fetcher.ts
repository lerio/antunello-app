import { createClient } from '@/utils/supabase/client'
import { Transaction } from '@/types/database'
import { transactionCache } from './simple-cache'

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
  // Key format: "range-transactions-STARTDate-ENDDate"
  const parts = key.split('-')
  // parts[0] = "range"
  // parts[1] = "transactions"
  // start date parts:
  // Since date is YYYY-MM-DD, splitting by '-' will break it.
  // Let's use a different key structure or parse carefully.
  // Better approach: Since the key is just for internal SWR/Cache, we can rely on the caller to construct it carefully,
  // OR we can pass the dates as arguments to the fetcher if we structure the SWR hook differently.
  // However, `dateRangeTransactionFetcher` matches the signature `(key: string) => Promise<Data>`.
  
  // Let's assume the key format is `range-transactions-${startDate}:${endDate}` to avoid issues with hyphens in dates.
  // Example: range-transactions-2023-01-01:2023-01-31
  
  const rangePart = key.replace('range-transactions-', '')
  const [startDate, endDate] = rangePart.split(':')

  if (!startDate || !endDate) {
      throw new Error(`Invalid date range key: ${key}`)
  }

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
      .order('created_at', { ascending: false })
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

export const createDateRangeKey = (startDate: string, endDate: string) => {
    return `range-transactions-${startDate}:${endDate}`
}

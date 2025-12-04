import useSWR from 'swr'
import { Transaction } from '@/types/database'
import { createClient } from '@/utils/supabase/client'

const allTransactionsFetcher = async (): Promise<Transaction[]> => {
  const supabase = createClient()
  
  // Get ALL transactions (no date filters)
  let allTransactions: Transaction[] = []
  let from = 0
  const batchSize = 1000
  
  while (true) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
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

export function useAllTransactions() {
  const { 
    data: transactions, 
    error, 
    isLoading,
    mutate
  } = useSWR<Transaction[]>('all-transactions', allTransactionsFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 60000, // 1 minute
    focusThrottleInterval: 300000, // 5 minutes
    refreshInterval: 0,
  })

  return {
    transactions: transactions || [],
    error,
    isLoading,
    mutate,
    refresh: () => mutate(),
  }
}
import useSWR from 'swr'
import { Transaction } from '@/types/database'
import { createClient } from '@/utils/supabase/client'
import { fetchAllBatches } from '@/utils/supabase/fetch-all'

const allTransactionsFetcher = async (): Promise<Transaction[]> => {
  const supabase = createClient()

  return fetchAllBatches<Transaction>((from, to) =>
    supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to)
  )
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

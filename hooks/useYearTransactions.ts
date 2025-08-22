import useSWR from 'swr'
import { useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Transaction } from '@/types/database'

const yearFetcher = async (year: number): Promise<Transaction[]> => {
  const supabase = createClient()
  
  // Get all transactions for the year
  const startDate = `${year}-01-01`
  const endDate = `${year}-12-31`
  
  // First, let's try a simple count to see total available
  const { count, error: countError } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .gte('date', startDate)
    .lte('date', endDate)
    
  if (countError) {
    console.error('Error getting count:', countError)
  }
  
  // Use pagination to get ALL transactions (bypassing any limits)
  let allTransactions: any[] = []
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
    
    if (error) {
      console.error('Error fetching year transactions:', error)
      throw error
    }
    
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

export function useYearTransactions(year: number) {
  const yearKey = `year-transactions-${year}`

  const { 
    data: transactions, 
    error, 
    isLoading 
  } = useSWR(yearKey, () => yearFetcher(year), {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 30000, // 30 seconds
    focusThrottleInterval: 60000, // 1 minute
    keepPreviousData: true,
    refreshInterval: 0,
  })

  return {
    transactions: transactions || [],
    error,
    isLoading
  }
}
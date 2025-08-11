import { createClient } from '@/utils/supabase/client'
import { Transaction } from '@/types/database'

// Shared transaction fetcher to ensure prefetch and hooks use the same function
export const transactionFetcher = async (key: string): Promise<Transaction[]> => {
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
import useSWR from 'swr'
import { createClient } from '@/utils/supabase/client'
import { Transaction } from '@/types/database'

const fetchTransaction = async (id: string) => {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  if (!data) throw new Error('Transaction not found')
  return data
}

export function useTransaction(id: string) {
  const { data: transaction, error, isLoading } = useSWR<Transaction>(
    id ? `transaction-${id}` : null,
    () => fetchTransaction(id),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      // Try to use cached data immediately if available
      fallbackData: undefined,
      dedupingInterval: 60000, // 1 minute
    }
  )

  return {
    transaction,
    isLoading,
    error
  }
} 
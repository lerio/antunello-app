import useSWR from 'swr'
import { supabase } from '@/utils/supabase'
import { Transaction } from '@/types/database'

const fetchTransaction = async (id: string) => {
  const { data } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .single()

  if (!data) throw new Error('Transaction not found')
  return data
}

export function useTransaction(id: string) {
  const { data: transaction, error, isLoading } = useSWR<Transaction>(
    id ? `transaction-${id}` : null,
    () => fetchTransaction(id),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false
    }
  )

  return {
    transaction,
    isLoading,
    error
  }
} 
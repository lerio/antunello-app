import useSWR from 'swr'
import { createClient } from '@/utils/supabase/client'
import { Transaction } from '@/types/database'

/**
 * Fetch a single transaction by its ID from the Supabase `transactions` table.
 *
 * @param id - The UUID of the transaction to fetch.
 * @returns The full `Transaction` object.
 * @throws If the query fails or no transaction with the given ID exists.
 */
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

/**
 * Hook to fetch a single transaction by its ID using SWR.
 *
 * The cache key is derived from the transaction ID so data is reused
 * across component mounts. Does not refetch on focus or reconnect.
 *
 * @param id - The UUID of the transaction to fetch.
 *
 * @returns An object containing:
 *  - `transaction` – The full `Transaction` object, or `undefined` while loading
 *  - `isLoading` – `true` while the request is in-flight
 *  - `error` – Any error that occurred during fetch
 */
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

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Transaction } from '@/types/database'

/**
 * Hook for real-time full-text search across transactions.
 *
 * Queries the `transactions` table with a case-insensitive substring match
 * against `title`, `main_category`, and `sub_category`. Results are ordered
 * by date (descending) and limited to 100 entries. The search is debounced
 * by 300 ms to avoid excessive database queries during typing.
 *
 * @param query - The user's search term.
 *
 * @returns An object containing:
 *  - `results` – Array of matching `Transaction` objects
 *  - `isLoading` – `true` while the search is in-flight
 *  - `error` – Any error that occurred during fetch
 *  - `refetch` – Manually trigger a re-fetch
 *  - `removeFromResults(id)` – Optimistically remove a transaction from results by ID
 */
export function useTransactionSearch(query: string) {
  const [results, setResults] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    if (!query.trim()) {
      setResults([])
      setIsLoading(false)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data, error: queryError } = await supabase
        .from('transactions')
        .select('*')
        .or(`title.ilike.%${query}%,main_category.ilike.%${query}%,sub_category.ilike.%${query}%`)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100)

      if (queryError) throw new Error(queryError.message)
      setResults(data || [])
    } catch (err) {
      setError(err as Error)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [query])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setIsLoading(false)
      setError(null)
      return
    }
    const timeoutId = setTimeout(() => { refetch() }, 300)
    return () => clearTimeout(timeoutId)
  }, [query, refetch])

  /**
   * Optimistically remove a transaction from the current result set by ID.
   * Useful after a transaction has been edited or deleted in a detail view
   * to keep the search results in sync without a full re-fetch.
   *
   * @param id - The UUID of the transaction to remove.
   */
  const removeFromResults = useCallback((id: string) => {
    setResults(prev => prev.filter(t => t.id !== id))
  }, [])

  return { results, isLoading, error, refetch, removeFromResults }
}

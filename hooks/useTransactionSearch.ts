import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Transaction } from '@/types/database'

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

  const removeFromResults = useCallback((id: string) => {
    setResults(prev => prev.filter(t => t.id !== id))
  }, [])

  return { results, isLoading, error, refetch, removeFromResults }
}

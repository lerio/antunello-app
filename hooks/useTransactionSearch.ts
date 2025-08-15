import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Transaction } from '@/types/database'

export function useTransactionSearch(query: string) {
  const [results, setResults] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setIsLoading(false)
      setError(null)
      return
    }

    const searchTransactions = async () => {
      setIsLoading(true)
      setError(null)
      
      try {
        const supabase = createClient()
        
        // Optimized search query - searches in title, main_category, and sub_category
        const { data, error: queryError } = await supabase
          .from('transactions')
          .select('*')
          .or(`title.ilike.%${query}%,main_category.ilike.%${query}%,sub_category.ilike.%${query}%`)
          .order('date', { ascending: false })
          .limit(100) // Limit results for performance
          
        if (queryError) {
          throw new Error(queryError.message)
        }
        
        setResults(data || [])
      } catch (err) {
        setError(err as Error)
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }

    // Debounce search to avoid too many API calls
    const timeoutId = setTimeout(searchTransactions, 300)
    
    return () => clearTimeout(timeoutId)
  }, [query])

  return { results, isLoading, error }
}
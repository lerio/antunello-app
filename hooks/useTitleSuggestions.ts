import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { TitleSuggestion } from '@/types/database'

export function useTitleSuggestions(query: string, minLength: number = 2) {
  const [suggestions, setSuggestions] = useState<TitleSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    // Only search if query meets minimum length requirement
    if (!query.trim() || query.length < minLength) {
      setSuggestions([])
      setIsLoading(false)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data, error: queryError } = await supabase
        .from('transaction_title_patterns')
        .select('*')
        .ilike('title', `%${query}%`)
        .order('last_used_at', { ascending: false })
        .order('frequency', { ascending: false })
        .limit(10) // Limit to top 10 suggestions

      if (queryError) throw new Error(queryError.message)
      setSuggestions(data || [])
    } catch (err) {
      setError(err as Error)
      setSuggestions([])
    } finally {
      setIsLoading(false)
    }
  }, [query, minLength])

  useEffect(() => {
    if (!query.trim() || query.length < minLength) {
      setSuggestions([])
      setIsLoading(false)
      setError(null)
      return
    }

    // Debounce the search to avoid too many requests
    const timeoutId = setTimeout(() => { refetch() }, 300)
    return () => clearTimeout(timeoutId)
  }, [query, minLength, refetch])

  const clearSuggestions = useCallback(() => {
    setSuggestions([])
    setError(null)
  }, [])

  return {
    suggestions,
    isLoading,
    error,
    refetch,
    clearSuggestions,
    hasSuggestions: suggestions.length > 0,
    shouldShowSuggestions: query.length >= minLength
  }
}
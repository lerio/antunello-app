import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Transaction } from '@/types/database'

export type FilterCriteria = {
  types: Array<'income' | 'expense' | 'movement'>
  mainCategories: string[]
  subCategories: string[]
  amountMin: number | null
  amountMax: number | null
  currencies: string[]
  month: number | null // null = all time
  year: number | null // null = all time
}

export const initialFilterCriteria: FilterCriteria = {
  types: [],
  mainCategories: [],
  subCategories: [],
  amountMin: null,
  amountMax: null,
  currencies: [],
  month: null,
  year: null,
}

export function useFilteredTransactions(criteria: FilterCriteria, enabled: boolean) {
  const [results, setResults] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const criteriaRef = useRef(criteria)
  criteriaRef.current = criteria

  const refetch = useCallback(async () => {
    if (!enabled) {
      setResults([])
      setIsLoading(false)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      let query = supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500)

      const { types, mainCategories, subCategories, amountMin, amountMax, currencies, month, year } = criteriaRef.current

      // Type filter with is_money_transfer handling
      if (types.length > 0) {
        const typeConditions: string[] = []

        if (types.includes('income')) {
          // Income transactions that are NOT money transfers
          typeConditions.push('and(type.eq.income,or(is_money_transfer.is.null,is_money_transfer.eq.false))')
        }
        if (types.includes('expense')) {
          // Expense transactions that are NOT money transfers
          typeConditions.push('and(type.eq.expense,or(is_money_transfer.is.null,is_money_transfer.eq.false))')
        }
        if (types.includes('movement')) {
          // Money transfer transactions (regardless of type)
          typeConditions.push('is_money_transfer.eq.true')
        }

        if (typeConditions.length > 0) {
          query = query.or(typeConditions.join(','))
        }
      }

      // Category filter
      if (mainCategories.length > 0) {
        query = query.in('main_category', mainCategories)
      }

      // Subcategory filter - extract just the subcategory name from "main::sub" format
      if (subCategories.length > 0) {
        const subCategoryNames = subCategories.map(sub => sub.split('::')[1] || sub)
        query = query.in('sub_category', subCategoryNames)
      }

      // Amount range filter
      if (amountMin !== null) {
        query = query.gte('amount', amountMin)
      }
      if (amountMax !== null) {
        query = query.lte('amount', amountMax)
      }

      // Currency filter
      if (currencies.length > 0) {
        query = query.in('currency', currencies)
      }

      // Date filter (month/year)
      if (year !== null && month !== null) {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`
        const lastDay = new Date(year, month, 0).getDate()
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
        query = query.gte('date', startDate).lte('date', endDate)
      } else if (year !== null) {
        // Year only filter
        query = query.gte('date', `${year}-01-01`).lte('date', `${year}-12-31`)
      }
      // If both are null, no date filter (all time)

      const { data, error: queryError } = await query

      if (queryError) throw new Error(queryError.message)
      setResults(data || [])
    } catch (err) {
      setError(err as Error)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      setResults([])
      setIsLoading(false)
      setError(null)
      return
    }

    // 300ms debounce for live filtering
    const timeoutId = setTimeout(() => { refetch() }, 300)
    return () => clearTimeout(timeoutId)
  }, [
    enabled,
    criteria.types.join(','),
    criteria.mainCategories.join(','),
    criteria.subCategories.join(','),
    criteria.amountMin,
    criteria.amountMax,
    criteria.currencies.join(','),
    criteria.month,
    criteria.year,
    refetch
  ])

  const removeFromResults = useCallback((id: string) => {
    setResults(prev => prev.filter(t => t.id !== id))
  }, [])

  return { results, isLoading, error, refetch, removeFromResults }
}

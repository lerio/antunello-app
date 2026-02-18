import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Transaction } from '@/types/database'
import { expandSplitTransactionsForMonth, expandSplitTransactionsForYear } from '@/utils/split-transactions'
import { sortTransactionsByDateInPlace } from '@/utils/transaction-utils'

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
      const hasMonthAndYear = year !== null && month !== null

      if (year !== null && month !== null) {
        // Use [start, nextMonthStart) to avoid dropping boundary-day timestamps.
        const startDate = new Date(year, month - 1, 1).toISOString()
        const nextMonthStart = new Date(year, month, 1).toISOString()
        query = query.gte('date', startDate).lt('date', nextMonthStart)
      } else if (year !== null) {
        // Use [yearStart, nextYearStart) for timestamp-safe year filtering.
        const yearStart = new Date(year, 0, 1).toISOString()
        const nextYearStart = new Date(year + 1, 0, 1).toISOString()
        query = query.gte('date', yearStart).lt('date', nextYearStart)
      }
      // If both are null, no date filter (all time)

      const { data, error: queryError } = await query

      if (queryError) throw new Error(queryError.message)

      let finalResults = data || []

      // Align split-transaction behavior with month/year views so totals use split values.
      if (year !== null && month !== null) {
        const yearStart = new Date(year, 0, 1).toISOString()
        const nextYearStart = new Date(year + 1, 0, 1).toISOString()

        const { data: splitInYear, error: splitError } = await supabase
          .from('transactions')
          .select('*')
          .eq('split_across_year', true)
          .gte('date', yearStart)
          .lt('date', nextYearStart)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(500)

        if (splitError) throw new Error(splitError.message)

        finalResults = sortTransactionsByDateInPlace(
          expandSplitTransactionsForMonth(finalResults, splitInYear || [], year, month)
        )
      } else if (year !== null && !hasMonthAndYear) {
        finalResults = sortTransactionsByDateInPlace(
          expandSplitTransactionsForYear(finalResults, year)
        )
      }

      setResults(finalResults)
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

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Transaction } from '@/types/database'
import { expandSplitTransactionsForMonth, expandSplitTransactionsForYear } from '@/utils/split-transactions'
import { sortTransactionsByDateInPlace } from '@/utils/transaction-utils'

/**
 * Criteria object for filtering transactions in the search/advanced-filter view.
 * Each array-based filter performs an OR match — any matching value includes the transaction.
 * When an array is empty, that filter is ignored.
 */
export type FilterCriteria = {
  /** Transaction types to include: `"income"`, `"expense"`, and/or `"movement"`. */
  types: Array<'income' | 'expense' | 'movement'>
  /** Main category names to include (e.g. `"Dining"`, `"Groceries"`). */
  mainCategories: string[]
  /** Subcategory filter entries in `"MainCategory::SubCategory"` format. */
  subCategories: string[]
  /** Fund category UUIDs to include. */
  fundSourceIds: string[]
  /** Minimum transaction amount (inclusive). `null` means no lower bound. */
  amountMin: number | null
  /** Maximum transaction amount (inclusive). `null` means no upper bound. */
  amountMax: number | null
  /** ISO currency codes to include (e.g. `"EUR"`, `"USD"`). */
  currencies: string[]
  /** Month number (1-12) for date filtering. `null` = all months. */
  month: number | null
  /** Year for date filtering. `null` = all years. */
  year: number | null
}

/** Default/empty filter criteria — all filters are disabled. */
export const initialFilterCriteria: FilterCriteria = {
  types: [],
  mainCategories: [],
  subCategories: [],
  fundSourceIds: [],
  amountMin: null,
  amountMax: null,
  currencies: [],
  month: null,
  year: null,
}

/**
 * Hook to perform client-side filtered searches against transactions.
 *
 * Builds a Supabase query dynamically from the given `FilterCriteria` and applies a
 * 300 ms debounce before executing. Supports compound type filtering (income/expense
 * combined with movement/money-transfer), split-transaction expansion for month/year
 * views, and an in-place removal helper.
 *
 * @param criteria - The filter criteria to apply.
 * @param enabled - When `false`, the query is skipped and results are cleared.
 * @returns An object containing:
 *  - `results`: The filtered `Transaction` array.
 *  - `isLoading`: `true` while a query is in-flight.
 *  - `error`: Any error encountered, or `null`.
 *  - `refetch`: Forces a new query with the latest criteria.
 *  - `removeFromResults`: Removes a single transaction from results by ID (optimistic).
 */
export function useFilteredTransactions(criteria: FilterCriteria, enabled: boolean) {
  const [results, setResults] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const criteriaRef = useRef(criteria)
  criteriaRef.current = criteria

  // Memoize joined strings so the useEffect dependency array receives stable
  // references — avoids re-firing the debounced query on every parent render.
  const typesKey = useMemo(() => criteria.types.join(','), [criteria.types])
  const mainCategoriesKey = useMemo(() => criteria.mainCategories.join(','), [criteria.mainCategories])
  const subCategoriesKey = useMemo(() => criteria.subCategories.join(','), [criteria.subCategories])
  const fundSourceIdsKey = useMemo(() => criteria.fundSourceIds.join(','), [criteria.fundSourceIds])
  const currenciesKey = useMemo(() => criteria.currencies.join(','), [criteria.currencies])

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

      const { types, mainCategories, subCategories, fundSourceIds, amountMin, amountMax, currencies, month, year } = criteriaRef.current

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

      // Fund filter: match fund_category_id for all transactions,
      // and target_fund_category_id for movement/money-transfer transactions.
      if (fundSourceIds.length > 0) {
        const ids = fundSourceIds.join(',')
        query = query.or(
          `fund_category_id.in.(${ids}),and(is_money_transfer.eq.true,target_fund_category_id.in.(${ids}))`
        )
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
    typesKey,
    mainCategoriesKey,
    subCategoriesKey,
    fundSourceIdsKey,
    criteria.amountMin,
    criteria.amountMax,
    currenciesKey,
    criteria.month,
    criteria.year,
    refetch
  ])

  const removeFromResults = useCallback((id: string) => {
    setResults(prev => prev.filter(t => t.id !== id))
  }, [])

  return { results, isLoading, error, refetch, removeFromResults }
}

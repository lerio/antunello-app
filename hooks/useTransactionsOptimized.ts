import useSWR, { mutate as globalMutate } from 'swr'
import { useCallback, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Transaction } from '@/types/database'
import { usePrefetch } from './usePrefetch'
import { transactionFetcher, createMonthKey } from '@/utils/transaction-fetcher'
import { createYearKey } from '@/utils/year-fetcher'
import { transactionCache } from '@/utils/simple-cache'
import { sortTransactionsByDateInPlace } from '@/utils/transaction-utils'
import { getTransactionDisplayAmount, getTransactionDisplayEurAmount } from '@/utils/split-transactions'

// Consolidated, optimized transactions hook
export function useTransactionsOptimized(year: number, month: number) {
  const supabase = createClient()
  const { prefetchAdjacentMonths } = usePrefetch()
  
  const monthKey = createMonthKey(year, month)

  // Helper to invalidate year cache
  const invalidateYearCache = useCallback((date: string) => {
    const transactionDate = new Date(date)
    const yearKey = createYearKey(transactionDate.getFullYear())
    globalMutate(yearKey, undefined, true)
    transactionCache.delete(yearKey)
  }, [])

  const { 
    data: transactions, 
    error, 
    mutate, 
    isLoading 
  } = useSWR<Transaction[]>(monthKey, transactionFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false, // Disabled to prevent hanging on iOS Safari tab wake
    dedupingInterval: 10000,
    focusThrottleInterval: 30000,
    keepPreviousData: true,
    refreshInterval: 0,
    // Use cache as fallback data to prevent loading states
    fallbackData: transactionCache.get(monthKey) || undefined,
  })

  // Intelligent prefetching of adjacent months
  useEffect(() => {
    // Only prefetch after the current month data has loaded or is cached
    if (!isLoading && !error) {
      prefetchAdjacentMonths(year, month)
    }
  }, [year, month, isLoading, error, prefetchAdjacentMonths])

  // Helper to extract date info from transaction
  const getDateInfo = (date: string) => {
    const recordDate = new Date(date)
    return {
      year: recordDate.getFullYear(),
      month: recordDate.getMonth() + 1,
      key: createMonthKey(recordDate.getFullYear(), recordDate.getMonth() + 1)
    }
  }

  // Helper to handle INSERT event
  const handleInsert = (newRecord: any) => {
    const recordInfo = getDateInfo(newRecord.date)

    if (recordInfo.year === year && recordInfo.month === month) {
      mutate((current: Transaction[] = []) => {
        // Replace temp transaction or add new one
        if (current.some(t => t.id === newRecord.id || t.id.startsWith('temp-'))) {
          return current.map(t => (t.id.startsWith('temp-') ? newRecord : t))
        }
        return sortTransactionsByDateInPlace([newRecord, ...current])
      }, false)
    }

    invalidateYearCache(newRecord.date)
    globalMutate('/api/overall-totals', undefined, true)
  }

  // Helper to handle UPDATE event
  const handleUpdate = (newRecord: any, oldRecord: any) => {
    const newDateInfo = getDateInfo(newRecord.date)
    const oldDateInfo = getDateInfo(oldRecord.date)

    if (newDateInfo.key !== oldDateInfo.key) {
      // Month changed
      globalMutate(oldDateInfo.key, (transactions: Transaction[] = []) => {
        return transactions.filter(t => t.id !== newRecord.id)
      }, false)

      globalMutate(newDateInfo.key, (transactions: Transaction[] = []) => {
        return sortTransactionsByDateInPlace([newRecord, ...transactions])
      }, false)
    } else if (newDateInfo.key === monthKey) {
      // Same month, update current view
      mutate((transactions: Transaction[] = []) => {
        return sortTransactionsByDateInPlace(transactions.map(t => (t.id === newRecord.id ? newRecord : t)))
      }, false)
    }

    // Invalidate year caches
    invalidateYearCache(oldRecord.date)
    if (newRecord.date !== oldRecord.date) {
      invalidateYearCache(newRecord.date)
    }
    globalMutate('/api/overall-totals', undefined, true)
  }

  // Helper to handle DELETE event
  const handleDelete = (oldRecord: any) => {
    const recordInfo = getDateInfo(oldRecord.date)

    if (recordInfo.year === year && recordInfo.month === month) {
      mutate((transactions: Transaction[] = []) => {
        return transactions.filter(t => t.id !== oldRecord.id)
      }, false)
    }

    invalidateYearCache(oldRecord.date)
    globalMutate('/api/overall-totals', undefined, true)
  }

  // Real-time subscriptions removed for iOS Safari optimization
  // Updates will be detected via background polling (see useBackgroundSync hook)

  // Memoized summary calculations
  const summary = useMemo(() => {
    if (!transactions?.length) return null

    const totals = transactions.reduce((acc, t) => {
      // Skip transactions that are hidden from totals
      if (t.hide_from_totals) return acc
      
      const currency = t.currency
      if (!acc[currency]) acc[currency] = { income: 0, expense: 0, count: 0 }

      const amount = getTransactionDisplayEurAmount(t) ?? getTransactionDisplayAmount(t)
      acc[currency][t.type] += amount
      acc[currency].count += 1
      
      return acc
    }, {} as Record<string, { income: number; expense: number; count: number }>)

    // Calculate net total in EUR
    const netTotal = Object.values(totals).reduce((sum, curr) => 
      sum + curr.income - curr.expense, 0
    )

    return { totals, netTotal }
  }, [transactions])

  return {
    transactions: transactions || [],
    summary,
    isLoading,
    error,
    mutate,
    // Simplified interface
    refresh: () => mutate(),
  }
}

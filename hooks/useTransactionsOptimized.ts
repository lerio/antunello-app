import useSWR, { mutate as globalMutate } from 'swr'
import { useCallback, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Transaction } from '@/types/database'
import { usePrefetch } from './usePrefetch'
import { transactionFetcher, createMonthKey } from '@/utils/transaction-fetcher'

// Consolidated, optimized transactions hook
export function useTransactionsOptimized(year: number, month: number) {
  const supabase = createClient()
  const { prefetchAdjacentMonths, isInCache } = usePrefetch()
  
  const monthKey = createMonthKey(year, month)
  const isInCacheResult = isInCache(monthKey)
  
  console.log(`🔍 Hook loading ${monthKey}, inCache: ${isInCacheResult}, will ${isInCacheResult ? 'use cache' : 'fetch fresh'}`)
  
  const { 
    data: transactions, 
    error, 
    mutate, 
    isLoading 
  } = useSWR<Transaction[]>(monthKey, transactionFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    revalidateOnMount: !isInCacheResult, // Only revalidate on mount if not already in cache
    dedupingInterval: 5000, // 5 seconds for more responsive updates
    focusThrottleInterval: 15000, // 15 seconds
    keepPreviousData: true, // Keep showing previous data while loading new
    refreshInterval: 0, // Disable automatic refresh, rely on realtime
  })

  // Intelligent prefetching of adjacent months
  useEffect(() => {
    // Only prefetch after the current month data has loaded
    if (!isLoading && !error) {
      prefetchAdjacentMonths(year, month)
    }
  }, [year, month, isLoading, error, prefetchAdjacentMonths])

  // Real-time subscription with simplified logic
  useEffect(() => {
    let channel: any

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      channel = supabase
        .channel(`transactions_${user.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${user.id}`
        }, (payload) => {
          handleRealtimeUpdate(payload)
        })
        .subscribe()
    }

    const handleRealtimeUpdate = (payload: any) => {
      const { eventType, new: newRecord, old: oldRecord } = payload
      
      // Handle different event types for better real-time sync
      if (eventType === 'INSERT' && newRecord) {
        const recordDate = new Date(newRecord.date)
        const recordYear = recordDate.getFullYear()
        const recordMonth = recordDate.getMonth() + 1
        const recordMonthKey = createMonthKey(recordYear, recordMonth)
        
        // Only update if it's for current month and not already in cache (avoid duplicates from optimistic updates)
        if (recordYear === year && recordMonth === month) {
          mutate((current: Transaction[] = []) => {
            // Check if transaction already exists (from optimistic update)
            if (current.some(t => t.id === newRecord.id || t.id.startsWith('temp-'))) {
              return current.map(t => t.id.startsWith('temp-') ? newRecord : t)
            }
            return [newRecord, ...current].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          }, false)
        }
      } else if (eventType === 'UPDATE' && newRecord && oldRecord) {
        const newRecordDate = new Date(newRecord.date)
        const oldRecordDate = new Date(oldRecord.date)
        
        const newMonthKey = createMonthKey(newRecordDate.getFullYear(), newRecordDate.getMonth() + 1)
        const oldMonthKey = createMonthKey(oldRecordDate.getFullYear(), oldRecordDate.getMonth() + 1)
        
        // Handle month changes
        if (newMonthKey !== oldMonthKey) {
          // Remove from old month
          globalMutate(oldMonthKey, (transactions: Transaction[] = []) => {
            return transactions.filter(t => t.id !== newRecord.id)
          }, false)
          
          // Add to new month
          globalMutate(newMonthKey, (transactions: Transaction[] = []) => {
            return [newRecord, ...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          }, false)
        } else if (newMonthKey === monthKey) {
          // Update in current month
          mutate((transactions: Transaction[] = []) => {
            return transactions.map(t => t.id === newRecord.id ? newRecord : t)
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          }, false)
        }
      } else if (eventType === 'DELETE' && oldRecord) {
        const recordDate = new Date(oldRecord.date)
        const recordYear = recordDate.getFullYear()
        const recordMonth = recordDate.getMonth() + 1
        
        if (recordYear === year && recordMonth === month) {
          mutate((transactions: Transaction[] = []) => {
            return transactions.filter(t => t.id !== oldRecord.id)
          }, false)
        }
      }
    }

    setupRealtime()
    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [year, month, mutate, supabase])

  // Memoized summary calculations
  const summary = useMemo(() => {
    if (!transactions?.length) return null

    const totals = transactions.reduce((acc, t) => {
      const currency = t.currency
      if (!acc[currency]) acc[currency] = { income: 0, expense: 0, count: 0 }
      
      acc[currency][t.type] += t.eur_amount || t.amount
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
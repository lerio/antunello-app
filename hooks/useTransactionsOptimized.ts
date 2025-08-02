import useSWR, { mutate as globalMutate } from 'swr'
import { useCallback, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Transaction } from '@/types/database'

// Consolidated, optimized transactions hook
export function useTransactionsOptimized(year: number, month: number) {
  const supabase = createClient()
  
  // Single optimized fetcher with intelligent caching
  const fetcher = useCallback(async (key: string) => {
    const [, targetYear, targetMonth] = key.split('-').map(Number)
    
    const start = new Date(targetYear, targetMonth - 1, 1)
    const end = new Date(targetYear, targetMonth, 0, 23, 59, 59)

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .gte('date', start.toISOString())
      .lte('date', end.toISOString())
      .order('date', { ascending: false })

    if (error) throw error
    return data || []
  }, [supabase])

  const monthKey = `transactions-${year}-${month}`
  
  const { 
    data: transactions, 
    error, 
    mutate, 
    isLoading 
  } = useSWR<Transaction[]>(monthKey, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 30000, // 30 seconds
    focusThrottleInterval: 60000, // 1 minute
  })

  // Prefetch adjacent months efficiently
  const prevMonthKey = useMemo(() => {
    const prevDate = new Date(year, month - 2, 1)
    return `transactions-${prevDate.getFullYear()}-${prevDate.getMonth() + 1}`
  }, [year, month])

  const nextMonthKey = useMemo(() => {
    const nextDate = new Date(year, month, 1)
    return `transactions-${nextDate.getFullYear()}-${nextDate.getMonth() + 1}`
  }, [year, month])

  // Prefetch with low priority
  useSWR(prevMonthKey, fetcher, { revalidateOnMount: false })
  useSWR(nextMonthKey, fetcher, { revalidateOnMount: false })

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
      
      // Update current month if affected
      const record = newRecord || oldRecord
      const recordDate = new Date(record.date)
      const recordYear = recordDate.getFullYear()
      const recordMonth = recordDate.getMonth() + 1

      if (recordYear === year && recordMonth === month) {
        mutate()
      }

      // Also invalidate adjacent months if they might be affected
      if (Math.abs(recordYear - year) <= 1) {
        const monthDiff = Math.abs((recordYear - year) * 12 + (recordMonth - month))
        if (monthDiff <= 1) {
          globalMutate(prevMonthKey)
          globalMutate(nextMonthKey)
        }
      }
    }

    setupRealtime()
    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [year, month, mutate, supabase, prevMonthKey, nextMonthKey])

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
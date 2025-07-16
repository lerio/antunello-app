import useSWR from 'swr'
import { useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Transaction } from '@/types/database'
import { cacheProvider } from '@/lib/cache-provider'
import { useAdvancedSync } from './useAdvancedSync'

// Enhanced fetcher with caching and error handling
const fetchTransactions = async (monthKey: string) => {
  const supabase = createClient()
  const [year, month] = monthKey.split('-').slice(1).map(Number)
  
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59)

  // Try cache first
  const cached = await cacheProvider.get<Transaction[]>(`transactions-${year}-${String(month).padStart(2, '0')}`)
  if (cached) {
    // Return cached data immediately, but revalidate in background
    setTimeout(() => {
      fetchFreshData(supabase, start, end).then(freshData => {
        if (JSON.stringify(freshData) !== JSON.stringify(cached)) {
          cacheProvider.set(`transactions-${year}-${String(month).padStart(2, '0')}`, freshData)
        }
      })
    }, 0)
    return cached
  }

  return fetchFreshData(supabase, start, end)
}

const fetchFreshData = async (supabase: any, start: Date, end: Date) => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .gte('date', start.toISOString())
    .lte('date', end.toISOString())
    .order('date', { ascending: false })

  if (error) throw error
  return data || []
}

export function useOptimizedTransactions(year: number, month: number) {
  const monthKey = `transactions-${year}-${String(month).padStart(2, '0')}`
  const { isOnline, queueOfflineSync } = useAdvancedSync()
  
  const { data: transactions, error, mutate, isLoading } = useSWR<Transaction[]>(
    monthKey,
    fetchTransactions,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      revalidateIfStale: false,
      dedupingInterval: 5000,
      // Use stale data while revalidating
      keepPreviousData: true,
      // Custom error retry
      errorRetryCount: isOnline ? 3 : 0,
      errorRetryInterval: 1000,
      // Polling when online
      refreshInterval: isOnline ? 60000 : 0, // 1 minute
    }
  )

  // Prefetch adjacent months
  const { data: prevMonthTransactions } = useSWR(
    `transactions-${month === 1 ? year - 1 : year}-${String(month === 1 ? 12 : month - 1).padStart(2, '0')}`,
    fetchTransactions,
    { revalidateOnMount: false }
  )

  const { data: nextMonthTransactions } = useSWR(
    `transactions-${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, '0')}`,
    fetchTransactions,
    { revalidateOnMount: false }
  )

  // Memoized computed values
  const summary = useMemo(() => {
    if (!transactions) return null

    const totals = transactions.reduce((acc, t) => {
      const currency = t.currency
      if (!acc[currency]) acc[currency] = { income: 0, expense: 0 }
      
      if (t.type === 'income') {
        acc[currency].income += t.amount
      } else {
        acc[currency].expense += t.amount
      }
      
      return acc
    }, {} as Record<string, { income: number; expense: number }>)

    return totals
  }, [transactions])

  const categoryBreakdown = useMemo(() => {
    if (!transactions) return null

    return transactions.reduce((acc, t) => {
      const category = t.main_category
      if (!acc[category]) acc[category] = { total: 0, count: 0 }
      
      acc[category].total += t.type === 'expense' ? t.amount : -t.amount
      acc[category].count += 1
      
      return acc
    }, {} as Record<string, { total: number; count: number }>)
  }, [transactions])

  // Handle offline updates
  useEffect(() => {
    if (!isOnline && transactions) {
      queueOfflineSync(monthKey, transactions)
    }
  }, [isOnline, transactions, monthKey, queueOfflineSync])

  // Cache warming for frequently accessed data
  useEffect(() => {
    if (transactions) {
      // Cache individual transactions
      transactions.forEach(transaction => {
        cacheProvider.set(`transaction-${transaction.id}`, transaction)
      })
    }
  }, [transactions])

  return {
    transactions: transactions || [],
    summary,
    categoryBreakdown,
    isLoading,
    error,
    mutate,
    isOnline,
    // Prefetched data for quick navigation
    prefetchedData: {
      prevMonth: prevMonthTransactions,
      nextMonth: nextMonthTransactions
    }
  }
}
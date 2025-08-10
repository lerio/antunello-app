import { useCallback, useRef } from 'react'
import { mutate, useSWRConfig } from 'swr'
import { createClient } from '@/utils/supabase/client'
import { Transaction } from '@/types/database'

// Track prefetch requests to avoid duplicates
const prefetchQueue = new Set<string>()
const prefetchDebounce = new Map<string, NodeJS.Timeout>()

export function usePrefetch() {
  const supabase = createClient()
  const prefetchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const { cache } = useSWRConfig()

  const isInCache = useCallback((monthKey: string): boolean => {
    return cache.get(monthKey) !== undefined
  }, [cache])

  const fetchMonth = useCallback(async (year: number, month: number): Promise<Transaction[]> => {
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 0, 23, 59, 59)

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .gte('date', start.toISOString())
      .lte('date', end.toISOString())
      .order('date', { ascending: false })
      .limit(1000)

    if (error) throw error
    return data || []
  }, [supabase])

  const prefetchMonth = useCallback(async (year: number, month: number, priority: 'low' | 'medium' = 'low') => {
    const monthKey = `transactions-${year}-${month}`
    
    // Skip if already in cache
    if (isInCache(monthKey)) {
      return
    }

    // Skip if already being prefetched
    if (prefetchQueue.has(monthKey)) {
      return
    }

    // Clear existing debounce for this month
    const existingTimeout = prefetchDebounce.get(monthKey)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    // Debounce prefetch requests
    const delay = priority === 'low' ? 500 : 100
    const timeoutId = setTimeout(async () => {
      prefetchQueue.add(monthKey)
      prefetchDebounce.delete(monthKey)

      try {
        console.log(`Prefetching ${monthKey}...`)
        
        // Use SWR's mutate to populate cache
        await mutate(monthKey, fetchMonth(year, month), {
          revalidate: false, // Don't revalidate, just populate cache
        })
        
        console.log(`✓ Prefetched ${monthKey}`)
      } catch (error) {
        console.warn(`Failed to prefetch ${monthKey}:`, error)
      } finally {
        prefetchQueue.delete(monthKey)
      }
    }, delay)

    prefetchDebounce.set(monthKey, timeoutId)
  }, [fetchMonth, isInCache])

  const prefetchAdjacentMonths = useCallback((currentYear: number, currentMonth: number) => {
    // Calculate previous month
    const prevDate = new Date(currentYear, currentMonth - 2, 1) // currentMonth is 1-based
    const prevYear = prevDate.getFullYear()
    const prevMonth = prevDate.getMonth() + 1

    // Calculate next month  
    const nextDate = new Date(currentYear, currentMonth, 1) // currentMonth is 1-based
    const nextYear = nextDate.getFullYear()
    const nextMonth = nextDate.getMonth() + 1

    // Clear any existing prefetch timeout
    if (prefetchTimeoutRef.current) {
      clearTimeout(prefetchTimeoutRef.current)
    }

    // Debounce the prefetch operation to avoid excessive requests when quickly changing months
    prefetchTimeoutRef.current = setTimeout(() => {
      // Prefetch previous month (higher priority)
      prefetchMonth(prevYear, prevMonth, 'medium')
      
      // Prefetch next month (lower priority, with slight delay)
      setTimeout(() => {
        prefetchMonth(nextYear, nextMonth, 'low')
      }, 200)
    }, 300)
  }, [prefetchMonth])

  const prefetchSpecificMonth = useCallback((year: number, month: number) => {
    prefetchMonth(year, month, 'medium')
  }, [prefetchMonth])

  return {
    prefetchAdjacentMonths,
    prefetchSpecificMonth,
    isInCache,
  }
}
import { useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import useSWR from 'swr'

export interface MonthOption {
  year: number
  month: number // 1-12
  date: Date
  label: string
  shortLabel: string
  isToday: boolean
  isFuture: boolean
}

const fetcher = async (): Promise<Date | null> => {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('transactions')
    .select('date')
    .order('date', { ascending: true })
    .limit(1)
    .single()
  
  if (error || !data) return null
  
  return new Date(data.date)
}

// Generate default fallback months (2 years back to 1 year forward)
const generateFallbackMonths = (): MonthOption[] => {
  const months: MonthOption[] = []
  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1

  // Start from 2 years ago
  const startDate = new Date(currentYear - 2, 0, 1)

  // End 12 months in the future
  const endDate = new Date(currentYear, currentMonth + 11, 1)

  let current = new Date(startDate)

  while (current <= endDate) {
    const year = current.getFullYear()
    const month = current.getMonth() + 1
    const monthDate = new Date(year, current.getMonth(), 1)

    const isToday = year === currentYear && month === currentMonth
    const isFuture = current > new Date(currentYear, currentMonth - 1, 1)

    // Create labels - no year for current year months
    const label = current.toLocaleDateString('en-US', {
      month: 'long',
      year: year === currentYear ? undefined : 'numeric'
    })

    const shortLabel = current.toLocaleDateString('en-US', {
      month: 'short',
      year: year === currentYear ? undefined : '2-digit'
    })

    months.push({
      year,
      month,
      date: monthDate,
      label,
      shortLabel,
      isToday,
      isFuture
    })

    // Move to next month
    current.setMonth(current.getMonth() + 1)
  }

  return months
}

export function useAvailableMonths() {
  const { data: firstTransactionDate, error } = useSWR('first-transaction-date', fetcher, {
    // Provide fallback data so selector shows immediately
    fallbackData: undefined,
    // Keep data fresh
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  })

  const availableMonths = useMemo(() => {
    // Use fallback months if no first transaction date yet
    if (!firstTransactionDate) {
      return generateFallbackMonths()
    }

    const months: MonthOption[] = []
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth() + 1

    // Start from first transaction date
    const startDate = new Date(firstTransactionDate.getFullYear(), firstTransactionDate.getMonth(), 1)

    // End 12 months in the future
    const endDate = new Date(currentYear, currentMonth + 11, 1) // +11 because we want 12 months in future

    let current = new Date(startDate)

    while (current <= endDate) {
      const year = current.getFullYear()
      const month = current.getMonth() + 1
      const monthDate = new Date(year, current.getMonth(), 1)

      const isToday = year === currentYear && month === currentMonth
      const isFuture = current > new Date(currentYear, currentMonth - 1, 1)

      // Create labels - no year for current year months
      const label = current.toLocaleDateString('en-US', {
        month: 'long',
        year: year === currentYear ? undefined : 'numeric'
      })

      const shortLabel = current.toLocaleDateString('en-US', {
        month: 'short',
        year: year === currentYear ? undefined : '2-digit'
      })

      months.push({
        year,
        month,
        date: monthDate,
        label,
        shortLabel,
        isToday,
        isFuture
      })

      // Move to next month
      current.setMonth(current.getMonth() + 1)
    }

    return months
  }, [firstTransactionDate])

  return {
    availableMonths,
    isLoading: false, // Always show months immediately
    error
  }
}
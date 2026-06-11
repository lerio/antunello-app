import { useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import useSWR from 'swr'

/**
 * Represents a single month option for date-picker / month-selector UI.
 */
export interface MonthOption {
  /** Calendar year (e.g. 2024). */
  year: number
  /** Calendar month (1-12). */
  month: number
  /** JavaScript Date set to the first day of this month. */
  date: Date
  /** Human-readable label, e.g. "January" (year omitted when it matches the current year). */
  label: string
  /** Abbreviated label, e.g. "Jan" (year omitted when it matches the current year). */
  shortLabel: string
  /** `true` if this month is the current calendar month. */
  isToday: boolean
  /** `true` if this month is in the future relative to today. */
  isFuture: boolean
}

/**
 * Fetcher that retrieves the earliest transaction date from Supabase.
 * Used to determine how far back the month selector should extend.
 */
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

/**
 * Hook to generate the list of available months for date navigation selectors.
 *
 * Fetches the earliest transaction date from the database to determine the start
 * of the range, then generates MonthOption entries from that date through 12
 * months in the future. While the earliest date is loading, a fallback range of
 * 2 years back to 1 year forward is shown so the selector appears immediately.
 *
 * @returns An object containing:
 *  - `availableMonths`: Array of `MonthOption` objects.
 *  - `isLoading`: Always `false` because fallback data is shown immediately.
 *  - `error`: Any error from SWR, or `undefined`.
 */
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

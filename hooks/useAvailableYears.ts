import { useMemo } from 'react'
import { YearOption } from '@/components/ui/horizontal-year-selector'

// Generate years from 2016 to current year + 5 years into the future
const generateYearRange = (): number[] => {
  const startYear = 2016
  const currentYear = new Date().getFullYear()
  const endYear = currentYear + 5 // Include 5 years into the future
  const years: number[] = []

  for (let year = startYear; year <= endYear; year++) {
    years.push(year)
  }

  return years
}

/**
 * Hook to generate the list of available years for date navigation selectors.
 *
 * Returns a static range from 2016 through 5 years in the future. No async
 * operations are required because the range is computed synchronously on the
 * client. Each entry is flagged as `isToday` (current calendar year) or
 * `isFuture` where applicable.
 *
 * @returns An object containing:
 *  - `availableYears`: Array of `YearOption` objects (from `@/components/ui/horizontal-year-selector`).
 *  - `isLoading`: Always `false` — no async operation needed.
 *  - `error`: Always `null`.
 */
export function useAvailableYears() {
  const availableYears: YearOption[] = useMemo(() => {
    const yearNumbers = generateYearRange()
    const now = new Date()
    const currentYear = now.getFullYear()

    return yearNumbers.map(year => ({
      year,
      isToday: year === currentYear,
      isFuture: year > currentYear,
    }))
  }, [])

  return {
    availableYears,
    isLoading: false, // No async operation needed
    error: null
  }
}

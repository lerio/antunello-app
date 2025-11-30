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
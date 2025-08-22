import { useMemo } from 'react'
import { YearOption } from '@/components/ui/horizontal-year-selector'

// Generate years from 2016 to 2025 (fixed range)
const generateYearRange = (): number[] => {
  const startYear = 2016
  const endYear = 2025
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
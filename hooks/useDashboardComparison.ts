import { useMemo } from 'react'
import { useDateRangeTransactions } from './useDateRangeTransactions'

function formatDate(date: Date): string {
    return date.toISOString().split('T')[0]
}

function subDays(date: Date, days: number): Date {
    const result = new Date(date)
    result.setDate(result.getDate() - days)
    return result
}

export function useDashboardComparison() {
    // Calculate date ranges
    // Current: Last 30 days (including today)
    // Prev: The 30 days before that
    // Last Year: The same 30-day period one year ago

    const dates = useMemo(() => {
        const today = new Date()
        const currentEnd = today
        const currentStart = subDays(today, 29) // 29 days ago + today = 30 days

        const prevEnd = subDays(currentStart, 1) // Day before current start
        const prevStart = subDays(prevEnd, 29) // 30 days duration

        const lastYearEnd = new Date(currentEnd)
        lastYearEnd.setFullYear(lastYearEnd.getFullYear() - 1)
        const lastYearStart = new Date(currentStart)
        lastYearStart.setFullYear(lastYearStart.getFullYear() - 1)

        return {
            current: { start: formatDate(currentStart), end: formatDate(currentEnd) },
            prev: { start: formatDate(prevStart), end: formatDate(prevEnd) },
            lastYear: { start: formatDate(lastYearStart), end: formatDate(lastYearEnd) }
        }
    }, []) // Empty dependency array as 'today' is effectively constant for the component lifecycle

    // Fetch data for all 3 ranges
    const currentData = useDateRangeTransactions(dates.current.start, dates.current.end)
    const prevData = useDateRangeTransactions(dates.prev.start, dates.prev.end)
    const lastYearData = useDateRangeTransactions(dates.lastYear.start, dates.lastYear.end)

    return {
        current: {
            transactions: currentData.transactions,
            label: "Last 30",
            startDate: dates.current.start,
            endDate: dates.current.end
        },
        prev: {
            transactions: prevData.transactions,
            label: "Prev 30d",
            startDate: dates.prev.start,
            endDate: dates.prev.end
        },
        lastYear: {
            transactions: lastYearData.transactions,
            label: "vs Last Year",
            startDate: dates.lastYear.start,
            endDate: dates.lastYear.end
        },
        isLoading: currentData.isLoading || prevData.isLoading || lastYearData.isLoading,
        refresh: async () => {
            await Promise.all([
                currentData.refresh(),
                prevData.refresh(),
                lastYearData.refresh()
            ])
        }
    }
}

import { useMemo } from 'react'
import { useDateRangeTransactions } from './useDateRangeTransactions'
import { getComparisonWindows30 } from '@/utils/comparison-windows'

/**
 * Hook to fetch transactions across three 30-day comparison periods for dashboard insights.
 *
 * Calculates three overlapping date ranges:
 *  - **Current**: Last 30 days (including today).
 *  - **Previous**: The 30 days immediately before the current period.
 *  - **Last Year**: The same 30-day window one calendar year ago.
 *
 * All three ranges are fetched concurrently with distinct SWR cache keys
 * so data is available independently for comparison charts and summaries.
 *
 * @returns An object containing:
 *  - `current`: Period data with `transactions`, `label`, `startDate`, and `endDate`.
 *  - `prev`: Period data for the preceding 30 days.
 *  - `lastYear`: Period data for the same window one year ago.
 *  - `isLoading`: `true` while any of the three fetches are in-flight.
 *  - `refresh`: Async function that revalidates all three caches concurrently.
 */
export function useDashboardComparison() {
    // Shared windows: identical to the ones used by the balance comparison
    // chart so overlapping `range-transactions-*` fetches dedupe via SWR.
    const dates = useMemo(() => getComparisonWindows30(), []) // Empty dependency array as 'today' is effectively constant for the component lifecycle

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

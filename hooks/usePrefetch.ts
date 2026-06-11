import { transactionFetcher, createMonthKey } from '@/utils/transaction-fetcher'
import { useAdjacentPrefetch } from './useAdjacentPrefetch'

/** Module-level dedup set shared across all consumers of this hook. */
const prefetchQueue = new Set<string>()

/**
 * Hook for intelligent prefetching of adjacent-month transaction data.
 *
 * When the user is viewing a given month, this hook proactively fetches
 * the previous and next months so navigation feels instant. Prefetch requests
 * are deduplicated (via a module-level set) and debounced (500 ms) to avoid
 * excessive network calls during rapid month-switching.
 *
 * @returns An object with:
 *  - `prefetchAdjacentMonths(year, month)` – prefetches the previous and next
 *    months relative to the given year/month pair.
 */
export function usePrefetch() {
  const { prefetchAdjacent } = useAdjacentPrefetch(
    prefetchQueue,
    createMonthKey,
    transactionFetcher,
    // Compute adjacent-month argument tuples
    (year: number, month: number): [number, number][] => {
      const prevDate = new Date(year, month - 2, 1)
      const nextDate = new Date(year, month, 1)
      return [
        [prevDate.getFullYear(), prevDate.getMonth() + 1],
        [nextDate.getFullYear(), nextDate.getMonth() + 1],
      ]
    }
  )

  return {
    prefetchAdjacentMonths: (year: number, month: number) => prefetchAdjacent(year, month),
  }
}

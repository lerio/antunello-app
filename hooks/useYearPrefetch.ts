import { yearTransactionFetcher, createYearKey } from '@/utils/year-fetcher'
import { useAdjacentPrefetch } from './useAdjacentPrefetch'

/** Module-level dedup set shared across all consumers of this hook. */
const yearPrefetchQueue = new Set<string>()

/**
 * Hook for prefetching year-level transaction data.
 *
 * When the user is viewing a given year, this hook proactively fetches
 * the previous and next years so that the yearly-summary view loads
 * instantly. Prefetch requests are deduplicated (via a module-level set)
 * and debounced (500 ms) to avoid excessive network calls during rapid
 * year-switching.
 *
 * @returns An object containing:
 *  - `prefetchAdjacentYears(currentYear)` – Prefetches the previous and next years
 *  - `prefetchYear(year)` – Prefetch a specific year directly
 */
export function useYearPrefetch() {
  const { prefetchItem, prefetchAdjacent } = useAdjacentPrefetch(
    yearPrefetchQueue,
    createYearKey,
    yearTransactionFetcher,
    // Compute adjacent-year argument tuples
    (year: number): [number][] => [
      [year - 1],
      [year + 1],
    ]
  )

  return {
    prefetchAdjacentYears: (year: number) => prefetchAdjacent(year),
    prefetchYear: (year: number) => prefetchItem(year),
  }
}

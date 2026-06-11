import { useCallback, useRef } from 'react'
import { transactionCache } from '@/utils/simple-cache'

/**
 * Generic prefetch hook that can prefetch data for adjacent periods (months, years, etc.).
 *
 * This hook extracts the common logic shared by `usePrefetch` and `useYearPrefetch`:
 * a module-level dedup set, an in-flight request tracker, cache checking, and a debounced
 * adjacent-prefetch scheduler. The caller provides the fetcher, key builder, and adjacent-key
 * computation, making the hook reusable for any data domain.
 *
 * @typeParam TArgs - The argument tuple type passed to `createKey` (e.g., `[number, number]` for months).
 *
 * @param dedupSet    - A module-level `Set<string>` that tracks in-flight or queued keys to prevent duplicates.
 * @param createKey   - Function that builds a cache/request key from arguments.
 * @param fetcher     - The data-fetching function to call for each key.
 * @param prefetchAdjacentKeys - Given the current period arguments, returns an array of argument
 *   tuples for the adjacent periods to prefetch.
 *
 * @returns An object containing:
 *  - `prefetchItem(...args)` – Prefetch a single item by its arguments.
 *  - `prefetchAdjacent(...args)` – Debounced prefetch of adjacent items relative to the given arguments.
 */
export function useAdjacentPrefetch<TArgs extends unknown[]>(
  dedupSet: Set<string>,
  createKey: (...args: TArgs) => string,
  fetcher: (key: string) => Promise<unknown>,
  prefetchAdjacentKeys: (...args: TArgs) => TArgs[]
) {
  const prefetchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  /**
   * Prefetch data for a single item identified by the given arguments.
   * Skips the request if data is already cached or queued.
   */
  const prefetchItem = useCallback(async (...args: TArgs) => {
    const key = createKey(...args)

    // Skip if already in cache or being prefetched
    if (transactionCache.has(key) || dedupSet.has(key)) {
      return
    }

    dedupSet.add(key)

    try {
      await fetcher(key)
    } catch (error) {
      console.warn(`Failed to prefetch ${key}:`, error)
    } finally {
      dedupSet.delete(key)
    }
  }, [createKey, fetcher, dedupSet])

  /**
   * Prefetch adjacent items relative to the current view.
   * Debounced by 500 ms to avoid duplicate requests during quick navigation.
   */
  const prefetchAdjacent = useCallback((...args: TArgs) => {
    const adjacent = prefetchAdjacentKeys(...args)

    // Clear any existing timeout
    if (prefetchTimeoutRef.current) {
      clearTimeout(prefetchTimeoutRef.current)
    }

    // Debounce prefetching to avoid excessive requests
    prefetchTimeoutRef.current = setTimeout(() => {
      for (const adjArgs of adjacent) {
        prefetchItem(...adjArgs)
      }
    }, 500)
  }, [prefetchAdjacentKeys, prefetchItem])

  return {
    prefetchItem,
    prefetchAdjacent,
  }
}

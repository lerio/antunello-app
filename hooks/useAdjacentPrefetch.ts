import { useCallback, useRef } from 'react'
import { transactionCache } from '@/utils/simple-cache'

/** Scheduled prefetch handle: either an idle-callback id or a timeout id. */
type PrefetchHandle = { handle: number; isIdle: boolean }

/**
 * Generic prefetch hook that can prefetch data for adjacent periods (months, years, etc.).
 *
 * This hook extracts the common logic shared by `usePrefetch` and `useYearPrefetch`:
 * a module-level dedup set, an in-flight request tracker, cache checking, and an
 * idle-gated adjacent-prefetch scheduler. The caller provides the fetcher, key builder,
 * and adjacent-key computation, making the hook reusable for any data domain.
 *
 * Prefetch is scheduled via `requestIdleCallback` (with a timeout) so it never
 * competes with the first paint on mobile; a `setTimeout` fallback covers
 * browsers without idle-callback support. Scheduling is skipped while the tab
 * is hidden.
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
 *  - `prefetchAdjacent(...args)` – Idle-gated prefetch of adjacent items relative to the given arguments.
 */
export function useAdjacentPrefetch<TArgs extends unknown[]>(
  dedupSet: Set<string>,
  createKey: (...args: TArgs) => string,
  fetcher: (key: string) => Promise<unknown>,
  prefetchAdjacentKeys: (...args: TArgs) => TArgs[]
) {
  const prefetchHandleRef = useRef<PrefetchHandle | undefined>(undefined)

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
   * Scheduled on idle (with a timeout fallback) so it doesn't compete with
   * the initial load; skipped entirely while the tab is hidden.
   */
  const prefetchAdjacent = useCallback((...args: TArgs) => {
    // Clear any existing scheduled prefetch
    if (prefetchHandleRef.current) {
      if (prefetchHandleRef.current.isIdle) {
        cancelIdleCallback(prefetchHandleRef.current.handle)
      } else {
        clearTimeout(prefetchHandleRef.current.handle)
      }
      prefetchHandleRef.current = undefined
    }

    // Don't prefetch while the tab is hidden (e.g. iOS Safari background)
    if (typeof document !== 'undefined' && document.hidden) {
      return
    }

    const adjacent = prefetchAdjacentKeys(...args)

    const runPrefetch = () => {
      for (const adjArgs of adjacent) {
        prefetchItem(...adjArgs)
      }
    }

    if (typeof requestIdleCallback === 'function') {
      prefetchHandleRef.current = {
        handle: requestIdleCallback(runPrefetch, { timeout: 3000 }),
        isIdle: true,
      }
    } else {
      prefetchHandleRef.current = {
        handle: window.setTimeout(runPrefetch, 1500),
        isIdle: false,
      }
    }
  }, [prefetchAdjacentKeys, prefetchItem])

  return {
    prefetchItem,
    prefetchAdjacent,
  }
}

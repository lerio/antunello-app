import useSWR from 'swr'
import { Transaction } from '@/types/database'
import {
  fetchSplitSourcesForYear,
  createSplitSourcesKey,
} from '@/utils/split-sources-fetcher'
import { transactionCache } from '@/utils/simple-cache'

/**
 * Hook to fetch split-across-year transaction sources spanning the given year
 * plus the previous year. Shared by the transactions page, the month fetcher,
 * and the transaction summary so all consumers read one SWR entry instead of
 * issuing duplicate queries.
 *
 * @param year - The year to fetch split sources for (`undefined` → no fetch).
 * @returns SWR response with the combined `Transaction[]` split sources.
 */
export function useSplitSourcesForYear(year?: number) {
  const key = year !== undefined ? createSplitSourcesKey(year) : null

  return useSWR<Transaction[]>(key, fetchSplitSourcesForYear, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 30000,
    keepPreviousData: true,
    // Use cache as fallback data to prevent loading states
    fallbackData: key ? transactionCache.get(key) || undefined : undefined,
  })
}

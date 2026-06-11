import useSWR from 'swr'

/**
 * Response shape from the overall-totals API endpoint.
 * Contains the total balance across all user transactions in EUR.
 */
export type TotalsResp = {
  /** Total balance in EUR */
  eurTotal: number
}

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error(`Failed to fetch totals: ${r.status}`)
  return r.json()
})

/**
 * Hook to fetch the overall total balance in EUR across all transactions.
 * Makes a GET request to `/api/overall-totals` and returns the result
 * with SWR caching (deduped for 60 seconds, no background refetch).
 *
 * @returns An object containing:
 *  - `totals`: the parsed `TotalsResp` data, or `undefined` while loading
 *  - `error`: any error that occurred during fetch
 *  - `isLoading`: `true` while the request is in-flight
 *  - `mutate`: SWR mutate function to revalidate or update the cache
 */
export function useOverallTotals() {
  const { data, error, isLoading, mutate } = useSWR<TotalsResp>(
    '/api/overall-totals',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000, // 1 minute
      refreshInterval: 0,
    }
  )
  return { totals: data, error, isLoading, mutate }
}

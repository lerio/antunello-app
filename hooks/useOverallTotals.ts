import useSWR from 'swr'

export type TotalsResp = {
  eurTotal: number
}

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error(`Failed to fetch totals: ${r.status}`)
  return r.json()
})

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

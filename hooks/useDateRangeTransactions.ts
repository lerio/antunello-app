import useSWR from 'swr'
import { Transaction } from '@/types/database'
import { dateRangeTransactionFetcher, createDateRangeKey } from '@/utils/date-range-fetcher'
import { transactionCache } from '@/utils/simple-cache'

export function useDateRangeTransactions(startDate: string, endDate: string) {
    const key = createDateRangeKey(startDate, endDate)

    const {
        data: transactions,
        error,
        isLoading,
        mutate
    } = useSWR<Transaction[]>(key, dateRangeTransactionFetcher, {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        dedupingInterval: 60000, // 1 minute
        focusThrottleInterval: 300000, // 5 minutes
        keepPreviousData: true,
        refreshInterval: 0,
        // Use cache as fallback data to prevent loading states
        fallbackData: transactionCache.get(key) || undefined,
    })

    return {
        transactions: transactions || [],
        error,
        isLoading,
        mutate,
        refresh: () => mutate(),
    }
}

import useSWR from 'swr'
import { Transaction } from '@/types/database'
import { createClient } from '@/utils/supabase/client'

export type TimeRange = '1m' | '1y' | '5y' | 'all';

// Partial transaction type with only fields needed for balance calculation
export type BalanceTransaction = {
  date: string
  type: 'expense' | 'income'
  eur_amount: number | null
  hide_from_totals: boolean | null
}

/**
 * Calculate start date for a given time range
 * Returns null for 'all' (no filter)
 */
function getStartDate(timeRange: TimeRange): string | null {
  const now = new Date();
  let daysAgo: number;

  switch (timeRange) {
    case '1m':
      daysAgo = 30;
      break;
    case '1y':
      daysAgo = 365;
      break;
    case '5y':
      daysAgo = 5 * 365;
      break;
    case 'all':
      return null; // No filter, fetch all
  }

  const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  return startDate.toISOString().split('T')[0]; // Return YYYY-MM-DD format
}

/**
 * Fetcher function that queries transactions within a specific date range
 */
const rangeTransactionsFetcher = async (
  _key: string,
  timeRange: TimeRange
): Promise<BalanceTransaction[]> => {
  const supabase = createClient();
  const startDate = getStartDate(timeRange);

  // Build query with optional date filter
  // Only select fields needed for balance calculation (75% payload reduction)
  let query = supabase
    .from('transactions')
    .select('date, type, eur_amount, hide_from_totals')
    .order('date', { ascending: true }); // Chronological order for balance calculation

  // Apply date filter if not 'all'
  if (startDate) {
    query = query.gte('date', startDate);
  }

  // For large datasets, use pagination
  // Most time ranges will have <1000 transactions, so single query is usually enough
  let allTransactions: BalanceTransaction[] = [];
  let from = 0;
  const batchSize = 1000;

  while (true) {
    const { data, error } = await query.range(from, from + batchSize - 1);

    if (error) throw error;

    if (!data || data.length === 0) {
      break; // No more data
    }

    allTransactions = [...allTransactions, ...data];

    if (data.length < batchSize) {
      break; // Got less than full batch, we're done
    }

    from += batchSize;
  }

  return allTransactions;
};

/**
 * Hook to fetch transactions for a specific time range
 * Uses separate cache keys per time range and hidden state for optimal performance
 */
export function useRangeTransactions(
  timeRange: TimeRange,
  includeHidden: boolean
) {
  // Create unique cache key per time range and hidden state
  const cacheKey = `balance-transactions-${timeRange}-${includeHidden}`;

  const {
    data: transactions,
    error,
    isLoading,
    mutate,
  } = useSWR<BalanceTransaction[]>(
    [cacheKey, timeRange], // Pass timeRange as dependency
    ([_, range]: [string, TimeRange]) => rangeTransactionsFetcher(cacheKey, range),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60000, // 1 minute
      focusThrottleInterval: 300000, // 5 minutes
      refreshInterval: 0,
    }
  );

  return {
    transactions: transactions || [],
    error,
    isLoading,
    mutate,
    refresh: () => mutate(),
  };
}

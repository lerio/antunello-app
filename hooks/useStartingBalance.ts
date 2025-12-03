import useSWR from 'swr'
import { createClient } from '@/utils/supabase/client'

export type TimeRange = '1m' | '1y' | '5y' | 'all';

/**
 * Calculate cutoff date for starting balance calculation
 * Returns null for 'all' (no prior balance needed)
 */
function getCutoffDate(timeRange: TimeRange): string | null {
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
      return null; // No prior balance for 'all'
  }

  const cutoffDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  return cutoffDate.toISOString().split('T')[0]; // Return YYYY-MM-DD format
}

/**
 * Fetcher function that calls the database RPC to calculate starting balance
 */
const startingBalanceFetcher = async (
  _key: string,
  timeRange: TimeRange,
  includeHidden: boolean,
  userId: string | undefined
): Promise<number> => {
  // For 'all' time range, no prior balance (we're showing everything from the beginning)
  if (timeRange === 'all') {
    return 0;
  }

  // Need user ID to query
  if (!userId) {
    return 0;
  }

  const cutoffDate = getCutoffDate(timeRange);
  if (!cutoffDate) {
    return 0;
  }

  const supabase = createClient();

  // Call the RPC function to get balance before cutoff date
  const { data, error } = await supabase.rpc('get_balance_before_date', {
    p_user_id: userId,
    p_date: cutoffDate,
    p_include_hidden: includeHidden,
  });

  if (error) {
    console.error('Error fetching starting balance:', error);
    throw error;
  }

  // RPC returns numeric value, convert to number
  return Number(data) || 0;
};

/**
 * Hook to fetch the starting balance before a time range
 * This replaces client-side iteration through all prior transactions
 */
export function useStartingBalance(
  timeRange: TimeRange,
  includeHidden: boolean,
  userId: string | undefined
) {
  // Create unique cache key per time range and hidden state
  const cacheKey = `starting-balance-${timeRange}-${includeHidden}`;

  const {
    data: startingBalance,
    error,
    isLoading,
    mutate,
  } = useSWR<number>(
    userId ? [cacheKey, timeRange, includeHidden, userId] : null, // Only fetch if we have userId
    ([_, range, hidden, uid]: [string, TimeRange, boolean, string]) => startingBalanceFetcher(cacheKey, range, hidden, uid),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60000, // 1 minute
      focusThrottleInterval: 300000, // 5 minutes
      refreshInterval: 0,
    }
  );

  return {
    startingBalance: startingBalance ?? 0,
    error,
    isLoading,
    mutate,
    refresh: () => mutate(),
  };
}

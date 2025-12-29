import useSWR from 'swr'
import { createClient } from '@/utils/supabase/client'
import { Transaction } from '@/types/database'

export type TimeRange = '1m' | '1y' | '5y' | 'all';

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
 * Fetcher function that queries transactions for a specific category/subcategory and date range
 */
const categoryTransactionsFetcher = async (
  _key: string,
  timeRange: TimeRange,
  category: string,
  subCategory?: string
): Promise<Transaction[]> => {
  const supabase = createClient();
  const startDate = getStartDate(timeRange);

  // Build query with category and optional subcategory/date filter
  let query = supabase
    .from('transactions')
    .select('*')
    .eq('main_category', category)
    .order('date', { ascending: true }); // Chronological order for aggregation

  // Apply subcategory filter if provided
  if (subCategory) {
    query = query.eq('sub_category', subCategory);
  }

  // Apply date filter if not 'all'
  if (startDate) {
    query = query.gte('date', startDate);
  }

  // For large datasets, use pagination
  let allTransactions: Transaction[] = [];
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
 * Hook to fetch transactions for a specific category/subcategory and time range
 * Uses separate cache keys per category, subcategory, and time range for optimal performance
 */
export function useCategoryTransactions(
  timeRange: TimeRange,
  category: string | null,
  subCategory?: string | null
) {
  // Create unique cache key per category, subcategory, and time range
  const cacheKey = category
    ? `category-transactions-${category}-${subCategory || 'all'}-${timeRange}`
    : null;

  const {
    data: transactions,
    error,
    isLoading,
    mutate,
  } = useSWR<Transaction[]>(
    cacheKey ? [cacheKey, timeRange, category, subCategory] : null,
    ([_, range, cat, subCat]: [string, TimeRange, string, string | undefined]) =>
      categoryTransactionsFetcher(cacheKey!, range, cat, subCat || undefined),
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

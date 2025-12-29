import { useMemo } from 'react';
import { useCategoryTransactions, type TimeRange } from './useCategoryTransactions';
import { Transaction } from '@/types/database';

export type { TimeRange } from './useCategoryTransactions';

export interface CategoryDataPoint {
  date: string;
  amount: number;
  transactionCount: number;
}

export interface CategoryStats {
  totalAmount: number;
  totalTransactions: number;
  dataPoints: CategoryDataPoint[];
}

/**
 * Calculate period key for a given date based on time range
 * Different from balance history:
 * - 1M: daily
 * - 1Y: monthly
 * - 5Y/All: yearly
 */
function getPeriodKey(date: Date, timeRange: TimeRange): string {
  switch (timeRange) {
    case '1m':
      // Daily aggregation
      return date.toISOString().split('T')[0];

    case '1y':
      // Monthly aggregation - first day of month
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;

    case '5y':
    case 'all':
      // Yearly aggregation - first day of year
      return `${date.getFullYear()}-01-01`;
  }
}

/**
 * Calculate category expense history from transactions
 */
/**
 * Calculate category expense history from transactions
 */
function calculateCategoryHistory(
  transactions: Transaction[],
  timeRange: TimeRange
): CategoryStats {
  const filtered = transactions.filter(t =>
    !t.hide_from_totals &&
    t.eur_amount !== null &&
    t.eur_amount !== undefined
  );

  // Determine start date and period generation logic
  const now = new Date();
  const periods = new Map<string, CategoryDataPoint>();
  let startDate = new Date();

  // Initialize all periods with 0 based on time range
  if (timeRange === '1m') {
    // Last 30 days
    startDate.setDate(now.getDate() - 30);
    // Loop through each day
    for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      periods.set(key, { date: key, amount: 0, transactionCount: 0 });
    }
  } else if (timeRange === '1y') {
    // Last 12 months
    startDate.setFullYear(now.getFullYear() - 1);
    startDate.setMonth(now.getMonth() + 1); // Start from next month of last year to cover 12 months including current

    // Normalize to first of month
    startDate.setDate(1);

    // Loop through each month
    const current = new Date(startDate);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // End of current month

    while (current <= end) {
      const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-01`;
      periods.set(key, { date: key, amount: 0, transactionCount: 0 });
      current.setMonth(current.getMonth() + 1);
    }
  } else if (timeRange === '5y') {
    // Last 5 years
    startDate.setFullYear(now.getFullYear() - 4); // Current year - 4 = 5 years total
    const currentYear = new Date(startDate.getFullYear(), 0, 1);

    for (let year = currentYear.getFullYear(); year <= now.getFullYear(); year++) {
      const key = `${year}-01-01`;
      periods.set(key, { date: key, amount: 0, transactionCount: 0 });
    }
  } else if (timeRange === 'all') {
    // For 'all', we only initialize if there's data, starting from the first transaction year
    if (filtered.length > 0) {
      // Find min year
      const minDate = filtered.reduce((min, t) => t.date < min ? t.date : min, filtered[0].date);
      const minYear = new Date(minDate).getFullYear();

      for (let year = minYear; year <= now.getFullYear(); year++) {
        const key = `${year}-01-01`;
        periods.set(key, { date: key, amount: 0, transactionCount: 0 });
      }
    }
  }

  // Merge actual data
  filtered.forEach(tx => {
    const date = new Date(tx.date);
    const periodKey = getPeriodKey(date, timeRange);

    if (!periods.has(periodKey)) {
      // Should mostly happen for 'all' range if data is outside generated range (unlikely if logic is correct)
      // or for 'all' if we just initialized above.
      // For fixed ranges, data older than the range is naturally excluded by not being in the map if we strictly check,
      // BUT getPeriodKey might return keys outside our initialized set?
      // Actually useCategoryTransactions fetches based on date range, so filtered transactions *should* be in range.
      // We'll add it if missing to be safe (e.g. slight timezone diffs or 'all' logic).
      periods.set(periodKey, {
        date: periodKey,
        amount: 0,
        transactionCount: 0,
      });
    }

    const period = periods.get(periodKey)!;
    const amount = Math.abs(tx.eur_amount as number);

    period.amount += amount;
    period.transactionCount++;
  });

  // Sort by date ascending
  const dataPoints = Array.from(periods.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // Calculate totals (from filtered transactions directly to avoid any period issues)
  const totalAmount = filtered.reduce((sum, t) => sum + Math.abs(t.eur_amount || 0), 0);
  const totalTransactions = filtered.length;

  return {
    totalAmount,
    totalTransactions,
    dataPoints,
  };
}

/**
 * Hook to get category/subcategory expense history with optimized range-based queries
 */
export function useCategoryHistory(
  timeRange: TimeRange,
  category: string | null,
  subCategory?: string | null
) {
  // Fetch transactions for the selected category/subcategory and time range
  const { transactions, isLoading, error } = useCategoryTransactions(
    timeRange,
    category,
    subCategory
  );

  const categoryStats = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return {
        totalAmount: 0,
        totalTransactions: 0,
        dataPoints: [],
      };
    }

    return calculateCategoryHistory(transactions, timeRange);
  }, [transactions, timeRange]);

  return {
    ...categoryStats,
    isLoading,
    error,
  };
}

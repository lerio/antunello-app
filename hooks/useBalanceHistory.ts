import { useMemo, useState, useEffect } from 'react';
import { useRangeTransactions, type BalanceTransaction } from './useRangeTransactions';
import { useStartingBalance } from './useStartingBalance';
import { createClient } from '@/utils/supabase/client';

export type TimeRange = '1m' | '1y' | '5y' | 'all';

export interface BalanceDataPoint {
  date: string;
  balance: number;
  income: number;
  expense: number;
  transactionCount: number;
}

export interface BalanceStats {
  startBalance: number;
  currentBalance: number;
  changeAmount: number;
  changePercent: number;
  dataPoints: BalanceDataPoint[];
}

/**
 * Calculate period key for a given date based on time range
 * Used for aggregating transactions into daily, weekly, or monthly buckets
 */
function getPeriodKey(date: Date, timeRange: TimeRange): string {
  switch (timeRange) {
    case '1m':
    case '1y':
      // Daily aggregation
      return date.toISOString().split('T')[0];

    case '5y':
      // Weekly aggregation - Monday of the week
      const monday = new Date(date);
      monday.setDate(date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1));
      return monday.toISOString().split('T')[0];

    case 'all':
      // Monthly aggregation - last day of month
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      return lastDay.toISOString().split('T')[0];
  }
}

/**
 * Calculate balance history from transactions
 * startBalance is now calculated by the database via useStartingBalance hook
 */
function calculateBalanceHistory(
  transactions: BalanceTransaction[],
  timeRange: TimeRange,
  includeHidden: boolean,
  startBalance: number
): BalanceStats {
  // Filter transactions in single pass (hide_from_totals and valid eur_amount)
  const filtered = transactions.filter(t =>
    (includeHidden || !t.hide_from_totals) &&
    t.eur_amount !== null &&
    t.eur_amount !== undefined
  );

  // No need to sort - useRangeTransactions already orders by date ascending
  const sorted = filtered;

  if (sorted.length === 0) {
    return {
      startBalance,
      currentBalance: startBalance,
      changeAmount: 0,
      changePercent: 0,
      dataPoints: [],
    };
  }

  // OPTIMIZED: Single-pass aggregation with running balance (O(n) instead of O(n²))
  const periods = new Map<string, BalanceDataPoint>();
  let runningBalance = startBalance;

  // Transactions already sorted chronologically, process in single pass
  sorted.forEach(tx => {
    const date = new Date(tx.date);
    const periodKey = getPeriodKey(date, timeRange);

    // Get or create period data point
    if (!periods.has(periodKey)) {
      periods.set(periodKey, {
        date: periodKey,
        balance: runningBalance,
        income: 0,
        expense: 0,
        transactionCount: 0,
      });
    }

    const period = periods.get(periodKey)!;
    const amount = tx.eur_amount as number;

    // Update running balance and period statistics
    if (tx.type === 'income') {
      runningBalance += amount;
      period.income += amount;
    } else {
      runningBalance -= amount;
      period.expense += amount;
    }

    period.balance = runningBalance;
    period.transactionCount++;
  });

  const dataPoints = Array.from(periods.values());

  const currentBalance = dataPoints.length > 0
    ? dataPoints[dataPoints.length - 1].balance
    : startBalance;

  const changeAmount = currentBalance - startBalance;
  const changePercent = startBalance !== 0
    ? (changeAmount / Math.abs(startBalance)) * 100
    : 0;

  return {
    startBalance,
    currentBalance,
    changeAmount,
    changePercent,
    dataPoints,
  };
}

/**
 * Hook to get balance history data with optimized range-based queries
 */
export function useBalanceHistory(
  timeRange: TimeRange,
  includeHidden: boolean
) {
  const [userId, setUserId] = useState<string | undefined>(undefined);

  // Get user ID for starting balance calculation
  useEffect(() => {
    const supabase = createClient();
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getUser();
  }, []);

  // Fetch transactions for the selected time range only
  const { transactions, isLoading: transactionsLoading, error: transactionsError } = useRangeTransactions(
    timeRange,
    includeHidden
  );

  // Fetch starting balance from database (efficient RPC call)
  const { startingBalance, isLoading: balanceLoading, error: balanceError } = useStartingBalance(
    timeRange,
    includeHidden,
    userId
  );

  const isLoading = transactionsLoading || balanceLoading;
  const error = transactionsError || balanceError;

  const balanceStats = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return {
        startBalance: startingBalance,
        currentBalance: startingBalance,
        changeAmount: 0,
        changePercent: 0,
        dataPoints: [],
      };
    }

    return calculateBalanceHistory(transactions, timeRange, includeHidden, startingBalance);
  }, [transactions, timeRange, includeHidden, startingBalance]);

  return {
    ...balanceStats,
    isLoading,
    error,
  };
}

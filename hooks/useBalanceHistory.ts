import { useMemo } from 'react';
import { useAllTransactions } from './useAllTransactions';
import { Transaction } from '@/types/database';

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
 * Calculate the date range based on the time range selection
 */
function getDateRange(timeRange: TimeRange): Date | null {
  const now = new Date();

  switch (timeRange) {
    case '1m':
      const oneMonthAgo = new Date(now);
      oneMonthAgo.setMonth(now.getMonth() - 1);
      return oneMonthAgo;
    case '1y':
      const oneYearAgo = new Date(now);
      oneYearAgo.setFullYear(now.getFullYear() - 1);
      return oneYearAgo;
    case '5y':
      const fiveYearsAgo = new Date(now);
      fiveYearsAgo.setFullYear(now.getFullYear() - 5);
      return fiveYearsAgo;
    case 'all':
      return null; // No date filter
  }
}

/**
 * Aggregate transactions by period (daily, weekly, or monthly)
 */
function aggregateByPeriod(
  transactions: Transaction[],
  timeRange: TimeRange
): Map<string, Transaction[]> {
  const periods = new Map<string, Transaction[]>();

  transactions.forEach(tx => {
    const date = new Date(tx.date);
    let periodKey: string;

    switch (timeRange) {
      case '1m':
      case '1y':
        // Daily aggregation
        periodKey = tx.date;
        break;
      case '5y':
        // Weekly aggregation - use Monday of the week
        const monday = new Date(date);
        monday.setDate(date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1));
        periodKey = monday.toISOString().split('T')[0];
        break;
      case 'all':
        // Monthly aggregation - use last day of month
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        periodKey = lastDay.toISOString().split('T')[0];
        break;
    }

    if (!periods.has(periodKey)) {
      periods.set(periodKey, []);
    }
    periods.get(periodKey)!.push(tx);
  });

  return periods;
}

/**
 * Calculate balance history from transactions
 */
function calculateBalanceHistory(
  transactions: Transaction[],
  timeRange: TimeRange,
  includeHidden: boolean
): BalanceStats {
  // Filter transactions
  const filtered = transactions
    .filter(t => includeHidden || !t.hide_from_totals)
    .filter(t => t.eur_amount !== null && t.eur_amount !== undefined);

  // Apply time range filter
  const cutoffDate = getDateRange(timeRange);
  const timeFiltered = cutoffDate
    ? filtered.filter(t => new Date(t.date) >= cutoffDate)
    : filtered;

  // Sort chronologically
  const sorted = [...timeFiltered].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  if (sorted.length === 0) {
    return {
      startBalance: 0,
      currentBalance: 0,
      changeAmount: 0,
      changePercent: 0,
      dataPoints: [],
    };
  }

  // Calculate balance before the time range for accurate starting balance
  const beforeCutoff = cutoffDate
    ? filtered.filter(t => new Date(t.date) < cutoffDate)
    : [];

  let startBalance = 0;
  beforeCutoff.forEach(tx => {
    const amount = tx.eur_amount as number;
    startBalance += tx.type === 'income' ? amount : -amount;
  });

  // Aggregate by period
  const periods = aggregateByPeriod(sorted, timeRange);

  // Calculate running balance for each period
  const dataPoints: BalanceDataPoint[] = [];
  let runningBalance = startBalance;

  const sortedPeriods = Array.from(periods.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  sortedPeriods.forEach(([periodDate, periodTransactions]) => {
    let periodIncome = 0;
    let periodExpense = 0;

    periodTransactions.forEach(tx => {
      const amount = tx.eur_amount as number;
      if (tx.type === 'income') {
        runningBalance += amount;
        periodIncome += amount;
      } else {
        runningBalance -= amount;
        periodExpense += amount;
      }
    });

    dataPoints.push({
      date: periodDate,
      balance: runningBalance,
      income: periodIncome,
      expense: periodExpense,
      transactionCount: periodTransactions.length,
    });
  });

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
 * Hook to get balance history data
 */
export function useBalanceHistory(
  timeRange: TimeRange,
  includeHidden: boolean
) {
  const { transactions, isLoading, error } = useAllTransactions();

  const balanceStats = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return {
        startBalance: 0,
        currentBalance: 0,
        changeAmount: 0,
        changePercent: 0,
        dataPoints: [],
      };
    }

    return calculateBalanceHistory(transactions, timeRange, includeHidden);
  }, [transactions, timeRange, includeHidden]);

  return {
    ...balanceStats,
    isLoading,
    error,
  };
}

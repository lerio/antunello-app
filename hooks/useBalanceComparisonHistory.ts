import { useEffect, useMemo, useState } from "react";
import { useDateRangeTransactions } from "./useDateRangeTransactions";
import {
  useStartingBalanceBeforeDate,
} from "./useStartingBalance";
import type { BalanceDataPoint } from "./useBalanceHistory";
import { createClient } from "@/utils/supabase/client";
import type { Transaction } from "@/types/database";
import { getStartDateForTimeRange } from "@/utils/time-range";

type BalanceTransaction = Transaction;

export interface BalanceComparisonDataPoint extends BalanceDataPoint {
  previousBalance: number | null;
}

export interface BalanceComparisonStats {
  dataPoints: BalanceComparisonDataPoint[];
  isLoading: boolean;
  error: Error | null | undefined;
}

function formatUtcDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function parseUtcDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function daysInclusive(startDate: string, endDate: string): number {
  const start = parseUtcDate(startDate);
  const end = parseUtcDate(endDate);
  const diff = end.getTime() - start.getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000)) + 1;
}

function getAmount(tx: BalanceTransaction): number {
  return tx.split_display_eur_amount !== null &&
    tx.split_display_eur_amount !== undefined
    ? tx.split_display_eur_amount
    : (tx.eur_amount as number);
}

function filterBalanceTransactions(
  transactions: BalanceTransaction[],
  includeHidden: boolean
) {
  return transactions.filter(
    (tx) =>
      (includeHidden || !tx.hide_from_totals) &&
      !tx.is_money_transfer &&
      (tx.split_display_eur_amount !== null &&
      tx.split_display_eur_amount !== undefined
        ? true
        : tx.eur_amount !== null && tx.eur_amount !== undefined)
  );
}

function getBucketStart(date: Date, timeRange: "1m" | "1y" | "5y"): Date {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);

  if (timeRange === "5y") {
    const day = result.getUTCDay();
    const delta = day === 0 ? -6 : 1 - day;
    result.setUTCDate(result.getUTCDate() + delta);
  }

  return result;
}

function addBucket(date: Date, timeRange: "1m" | "1y" | "5y"): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + (timeRange === "5y" ? 7 : 1));
  return result;
}

function getBucketKey(date: Date, timeRange: "1m" | "1y" | "5y"): string {
  if (timeRange === "5y") {
    return getBucketStart(date, timeRange).toISOString().split("T")[0];
  }

  return date.toISOString().split("T")[0];
}

function buildSeries(
  transactions: BalanceTransaction[],
  startDate: string,
  endDate: string,
  startBalance: number,
  includeHidden: boolean,
  timeRange: "1m" | "1y" | "5y"
): BalanceDataPoint[] {
  const filtered = filterBalanceTransactions(transactions, includeHidden);
  const sorted = [...filtered].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const start = getBucketStart(parseUtcDate(startDate), timeRange);
  const end = getBucketStart(parseUtcDate(endDate), timeRange);
  const lowerBound = parseUtcDate(startDate).getTime();
  const points: BalanceDataPoint[] = [];
  let runningBalance = startBalance;
  let txIndex = 0;

  for (
    let current = new Date(start);
    current.getTime() <= end.getTime();
    current = addBucket(current, timeRange)
  ) {
    const bucketKey = getBucketKey(current, timeRange);
    const bucketEndExclusive = addBucket(current, timeRange).getTime();
    let income = 0;
    let expense = 0;
    let transactionCount = 0;

    while (txIndex < sorted.length) {
      const txDate = new Date(sorted[txIndex].date);
      const txTime = txDate.getTime();
      if (txTime >= bucketEndExclusive) {
        break;
      }

      if (txTime >= lowerBound) {
        const amount = getAmount(sorted[txIndex]);
        if (sorted[txIndex].type === "income") {
          runningBalance += amount;
          income += amount;
        } else {
          runningBalance -= amount;
          expense += amount;
        }
        transactionCount += 1;
      }

      txIndex += 1;
    }

    points.push({
      date: bucketKey,
      balance: runningBalance,
      income,
      expense,
      transactionCount,
    });
  }

  return points;
}

/**
 * Returns the selected chart series plus a previous-period overlay series.
 */
export function useBalanceComparisonHistory(
  timeRange: "1m" | "1y" | "5y",
  includeHidden: boolean
) {
  const [userId, setUserId] = useState<string | undefined>(undefined);

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

  const currentEndDate = useMemo(() => formatUtcDate(new Date()), []);
  const currentStartDate = useMemo(
    () => getStartDateForTimeRange(timeRange) ?? currentEndDate,
    [currentEndDate, timeRange]
  );

  const currentSpanDays = useMemo(
    () => daysInclusive(currentStartDate, currentEndDate),
    [currentStartDate, currentEndDate]
  );

  const previousEndDate = useMemo(() => {
    const start = parseUtcDate(currentStartDate);
    return formatUtcDate(addUtcDays(start, -1));
  }, [currentStartDate]);

  const previousStartDate = useMemo(() => {
    const previousEnd = parseUtcDate(previousEndDate);
    return formatUtcDate(addUtcDays(previousEnd, -(currentSpanDays - 1)));
  }, [currentSpanDays, previousEndDate]);

  const currentTransactions = useDateRangeTransactions(
    currentStartDate,
    currentEndDate
  );
  const previousTransactions = useDateRangeTransactions(
    previousStartDate,
    previousEndDate
  );

  const currentStartingBalance = useStartingBalanceBeforeDate(
    currentStartDate,
    includeHidden,
    userId
  );
  const previousStartingBalance = useStartingBalanceBeforeDate(
    previousStartDate,
    includeHidden,
    userId
  );

  const result = useMemo(() => {
    const currentSeries = buildSeries(
      currentTransactions.transactions,
      currentStartDate,
      currentEndDate,
      currentStartingBalance.startingBalance,
      includeHidden,
      timeRange
    );
    const previousSeries = buildSeries(
      previousTransactions.transactions,
      previousStartDate,
      previousEndDate,
      previousStartingBalance.startingBalance,
      includeHidden,
      timeRange
    );

    return currentSeries.map((point, index) => ({
      ...point,
      previousBalance: previousSeries[index]?.balance ?? null,
    }));
  }, [
    currentTransactions.transactions,
    currentStartDate,
    currentEndDate,
    currentStartingBalance.startingBalance,
    previousTransactions.transactions,
    previousStartDate,
    previousEndDate,
    previousStartingBalance.startingBalance,
    includeHidden,
  ]);

  return {
    dataPoints: result,
    isLoading:
      currentTransactions.isLoading ||
      previousTransactions.isLoading ||
      currentStartingBalance.isLoading ||
      previousStartingBalance.isLoading,
    error:
      currentTransactions.error ||
      previousTransactions.error ||
      currentStartingBalance.error ||
      previousStartingBalance.error,
  };
}

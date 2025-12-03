"use client";

import { formatCurrency } from "@/utils/currency";
import { useOverallTotals } from "@/hooks/useOverallTotals";
import { Skeleton } from "@/components/ui/skeleton";

export default function OverallTotals() {
  const { totals, isLoading, error } = useOverallTotals();

  const eurTotal = totals?.eurTotal || 0;

  if (error) return null;

  const formatAmount = (amount: number) =>
    formatCurrency(amount, "EUR")
      .replaceAll("€", "")
      .replaceAll("$", "")
      .replaceAll("£", "")
      .replaceAll("¥", "")
      .replaceAll("₹", "");

  const amountColorClass = eurTotal >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-3 sm:p-4 mb-2 mt-4 sm:mb-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-200 m-0">Balance</h3>
        <div className={`text-base sm:text-lg font-semibold ${amountColorClass}`}>
          {isLoading ? (
            <Skeleton className="inline-block w-20 h-5" />
          ) : (
            <>€{formatAmount(Math.abs(eurTotal))}</>
          )}
        </div>
      </div>
    </div>
  );
}

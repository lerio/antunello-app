"use client";

import { formatCurrency } from "@/utils/currency";
import { useOverallTotals } from "@/hooks/useOverallTotals";

export default function OverallTotals() {
  const { totals, isLoading, error } = useOverallTotals();

  const eurTotal = totals?.eurTotal || 0;

  if (error) return null;

  const formatAmount = (amount: number) =>
    formatCurrency(amount, "EUR").replace(/[€$£¥₹]/g, "");

  const amountColorClass = eurTotal >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-3 sm:p-4 mb-1 mt-4 sm:mb-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-200 m-0">Balance</h3>
        <div className={`text-base sm:text-lg font-semibold ${amountColorClass}`}>
          {isLoading ? (
            <span className="inline-block w-20 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ) : (
            <>€{formatAmount(Math.abs(eurTotal))}</>
          )}
        </div>
      </div>
    </div>
  );
}

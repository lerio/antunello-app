"use client";

import React from "react";
import { formatCurrency } from "@/utils/currency";
import { useOverallTotals } from "@/hooks/useOverallTotals";

type OverallTotalsProps = {};

export default function OverallTotals({}: OverallTotalsProps) {
  const { totals, isLoading, error } = useOverallTotals();

  const eurTotal = totals?.eurTotal || 0;

  if (error) return null;

  const formatAmount = (amount: number) =>
    formatCurrency(amount, "EUR").replace(/[€$£¥₹]/g, "");

  const amountColorClass = eurTotal >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 sm:p-6 mb-2 mt-4 sm:mb-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            Balance
          </div>
          <div className={`text-xl sm:text-2xl font-bold ${amountColorClass}`}>
            {isLoading ? (
              <span className="inline-block w-20 h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            ) : (
              <>€{formatAmount(Math.abs(eurTotal))}</>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

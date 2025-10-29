"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/utils/currency";
import { useFundCategories } from "@/hooks/useFundCategories";
import { convertToEUR } from "@/utils/currency-conversion";

export default function Balance() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { fundCategories, isLoading, error, totalBalanceEUR } = useFundCategories();

  if (error) return null;

  const formatAmount = (amount: number) =>
    formatCurrency(amount, "EUR")
      .replaceAll("€", "")
      .replaceAll("$", "")
      .replaceAll("£", "")
      .replaceAll("¥", "")
      .replaceAll("₹", "");

  const amountColorClass = totalBalanceEUR >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-3 sm:p-4 mb-2 mt-4 sm:mb-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-200 m-0">Balance</h3>
        <div className="flex items-center gap-2">
          <div className={`text-base sm:text-lg font-semibold ${amountColorClass}`}>
            {isLoading ? (
              <span className="inline-block w-20 h-[1.375rem] bg-gray-200 dark:bg-gray-700 rounded animate-pulse align-middle" />
            ) : (
              <>€{formatAmount(Math.abs(totalBalanceEUR))}</>
            )}
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            aria-label={isExpanded ? "Collapse balance details" : "Expand balance details"}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse" />
                </div>
              ))}
            </div>
          ) : fundCategories.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
              No fund categories configured. Add some in the admin settings.
            </p>
          ) : (
            <div className="space-y-2">
              {fundCategories
                .filter(fund => fund.is_active)
                .sort((a, b) => (b.eur_amount || 0) - (a.eur_amount || 0))
                .map((fund) => (
                  <div
                    key={fund.id}
                    className="flex justify-between items-center py-1 px-2 hover:bg-gray-50 dark:hover:bg-gray-750 rounded"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {fund.name}
                      </div>
                      {fund.description && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {fund.description}
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {formatCurrency(fund.current_amount || fund.amount, fund.currency)}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
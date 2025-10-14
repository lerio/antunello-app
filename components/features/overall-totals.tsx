"use client";

import React, { useState, useMemo } from "react";
import { Transaction } from "@/types/database";
import { formatCurrency } from "@/utils/currency";
import { ChevronDown } from "lucide-react";

import { useOverallTotals } from "@/hooks/useOverallTotals";

type OverallTotalsProps = {};

export default function OverallTotals({}: OverallTotalsProps) {
  const [selectedCurrency, setSelectedCurrency] = useState<string>("EUR");
  const { totals, isLoading, error } = useOverallTotals();

  const currencies = useMemo(() => {
    if (!totals) return [] as string[];
    return Object.keys(totals.currencyTotals).sort();
  }, [totals]);

  const selectedCurrencyTotal = totals?.currencyTotals[selectedCurrency] || 0;
  const selectedCurrencyEurTotal = totals?.currencyEurTotals[selectedCurrency] || 0;
  const eurTotal = totals?.eurTotal || 0;

  const formatAmount = (amount: number, currency: string = "EUR") => {
    return formatCurrency(amount, currency).replace(/[€$£¥₹]/g, "");
  };

  if (error) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 sm:p-6 mb-2 mt-4 sm:mb-6">
      {/* Total EUR since beginning */}
      <div className="mb-2">
        <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
          Total Balance
        </div>
        <div className="text-[20px] font-bold text-gray-900 dark:text-gray-100">
          {isLoading ? (
            <span className="inline-block w-24 h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ) : (
            <span className={eurTotal >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
              €{formatAmount(Math.abs(eurTotal))}
            </span>
          )}
        </div>
      </div>

      {/* Currency breakdown */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
        <div className="flex items-center justify-between gap-4">
          <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
            By Currency
          </div>

          {/* Compact Currency Pills */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {currencies.map((currency) => (
              <button
                key={currency}
                onClick={() => setSelectedCurrency(currency)}
                disabled={isLoading}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                  selectedCurrency === currency
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                {currency}
              </button>
            ))}
          </div>
        </div>

        {/* Selected currency amount */}
        <div className="mt-2 text-right">
          {isLoading ? (
            <span className="inline-block w-32 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ) : (
            <div className="flex items-baseline justify-end gap-2">
              {selectedCurrency !== "EUR" && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ≈ €{formatAmount(Math.abs(selectedCurrencyEurTotal))}
                </span>
              )}
              <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {formatAmount(Math.abs(selectedCurrencyTotal), selectedCurrency)} {selectedCurrency}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

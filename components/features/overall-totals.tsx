"use client";

import React, { useState, useMemo } from "react";
import { Transaction } from "@/types/database";
import { formatCurrency } from "@/utils/currency";
import { ChevronDown } from "lucide-react";

type OverallTotalsProps = {
  allTransactions: Transaction[];
};

export default function OverallTotals({ allTransactions }: OverallTotalsProps) {
  const [selectedCurrency, setSelectedCurrency] = useState<string>("EUR");

  // Calculate totals by currency and overall EUR total
  const { eurTotal, currencyTotals, currencyEurTotals, allCurrencies } = useMemo(() => {
    const currencyTotals: Record<string, number> = {};
    const currencyEurTotals: Record<string, number> = {};
    const allCurrencies = new Set<string>();
    let eurTotal = 0;

    allTransactions.forEach((transaction) => {
      const { currency, amount, eur_amount, type } = transaction;
      const eurAmount = eur_amount || amount;

      // Track all currencies that appear
      allCurrencies.add(currency);

      // Track by original currency
      if (!currencyTotals[currency]) {
        currencyTotals[currency] = 0;
        currencyEurTotals[currency] = 0;
      }
      
      // For currency totals, add income and subtract expenses
      if (type === 'income') {
        currencyTotals[currency] += amount;
        currencyEurTotals[currency] += eurAmount;
        eurTotal += eurAmount;
      } else { // expense
        currencyTotals[currency] -= amount;
        currencyEurTotals[currency] -= eurAmount;
        eurTotal -= eurAmount;
      }
    });

    return { eurTotal, currencyTotals, currencyEurTotals, allCurrencies: Array.from(allCurrencies) };
  }, [allTransactions]);

  const currencies = allCurrencies.sort();
  const selectedCurrencyTotal = currencyTotals[selectedCurrency] || 0;
  const selectedCurrencyEurTotal = currencyEurTotals[selectedCurrency] || 0;

  const formatAmount = (amount: number, currency: string = "EUR") => {
    return formatCurrency(amount, currency).replace(/[€$£¥₹]/g, "");
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
      <div className="flex items-center justify-between">
        {/* Left: Total EUR since beginning */}
        <div className="flex-1">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            Total since beginning
          </div>
          <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
            €{formatAmount(Math.abs(eurTotal))}
          </div>
        </div>

        {/* Right: Currency selector and totals */}
        <div className="flex-1 max-w-xs">
          {/* Currency Dropdown */}
          <div className="relative mb-2">
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="w-full appearance-none bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {currencies.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"
            />
          </div>

          {/* Selected currency total */}
          <div className="text-right">
            <div className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
              {formatAmount(Math.abs(selectedCurrencyTotal), selectedCurrency)} {selectedCurrency}
            </div>
            {/* EUR equivalent for non-EUR currencies */}
            {selectedCurrency !== "EUR" && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                ≈ €{formatAmount(Math.abs(selectedCurrencyEurTotal))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
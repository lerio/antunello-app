"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useYearTransactions } from "@/hooks/useYearTransactions";
import { useAvailableYears } from "@/hooks/useAvailableYears";
import { HorizontalYearSelector } from "@/components/ui/horizontal-year-selector";
import { Button } from "@/components/ui/button";

import TransactionSummary from "@/components/features/transaction-summary";


export default function YearSummaryPage() {
  const searchParams = useSearchParams();

  const initialYear = useMemo(() => {
    const yearParam = searchParams.get("year");
    if (yearParam) {
      const year = Number.parseInt(yearParam);
      return Number.isNaN(year) ? new Date().getFullYear() : year;
    }
    return new Date().getFullYear();
  }, [searchParams]);

  const [currentYear, setCurrentYear] = useState(initialYear);

  useEffect(() => {
    setCurrentYear(initialYear);
  }, [initialYear]);

  const { transactions, isLoading, error } = useYearTransactions(currentYear);
  const { availableYears, isLoading: yearsLoading } = useAvailableYears();

  const handleYearSelect = useCallback((year: number) => {
    setCurrentYear(year);

    const now = new Date();
    const isCurrentYear = year === now.getFullYear();

    const newUrl = isCurrentYear
      ? "/protected/year"
      : `/protected/year?year=${year}`;

    if (typeof globalThis.history?.pushState === "function") {
      globalThis.history.pushState(null, "", newUrl);
    }
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">
            Error Loading Year Data
          </h2>
          <p className="text-gray-600">{error.message}</p>
          <Button onClick={() => globalThis.location?.reload?.()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Year Title Row */}
        <div className="flex items-center justify-center pt-4 pb-4">
          <h1 className="px-6 py-1 text-xl font-bold text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
            {currentYear}
          </h1>
        </div>



        {/* Sticky Horizontal Year Selector */}
        <div className="sticky top-0 bg-gray-50 dark:bg-gray-900 z-50 -mx-6 px-6">
          {yearsLoading ? (
            <div className="flex justify-center">
              <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-12 w-80 rounded-lg"></div>
            </div>
          ) : (
            <HorizontalYearSelector
              years={availableYears}
              selectedYear={currentYear}
              onYearSelect={handleYearSelect}
            />
          )}
        </div>

        {/* Year Summary - Using TransactionSummary component with yearly data */}
        <TransactionSummary
          transactions={transactions}
          isLoading={isLoading}
          includeHiddenInTotals={true}
          currentYear={currentYear}
        />

      </div>
    </div>
  );
}
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUp, Search } from "lucide-react";
import { useYearTransactions } from "@/hooks/useYearTransactions";
import { useAvailableYears } from "@/hooks/useAvailableYears";
import { HorizontalYearSelector } from "@/components/ui/horizontal-year-selector";
import { Button } from "@/components/ui/button";
import { FloatingButton } from "@/components/ui/floating-button";
import { TransactionViewTabs } from "@/components/ui/transaction-view-tabs";

import TransactionSummary from "@/components/features/transaction-summary";

export default function YearSummaryPage() {
  const router = useRouter();
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
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    setCurrentYear(initialYear);
  }, [initialYear]);

  const { transactions, isLoading, error } = useYearTransactions(currentYear);
  const { availableYears, isLoading: yearsLoading } = useAvailableYears();

  // Handle scroll to show/hide scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      const win = globalThis as unknown as Window;
      setShowScrollTop(typeof win.scrollY === "number" && win.scrollY > 300);
    };

    if (typeof globalThis.addEventListener === "function") {
      globalThis.addEventListener("scroll", handleScroll as EventListener);
      return () =>
        globalThis.removeEventListener("scroll", handleScroll as EventListener);
    }
    return undefined;
  }, []);

  const scrollToTop = useCallback(() => {
    const win = globalThis as unknown as Window;
    if (typeof win.scrollTo === "function") {
      win.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  }, []);

  const handleSearchClick = useCallback(() => {
    router.push(`/protected/search?from_year=${currentYear}`);
  }, [router, currentYear]);

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
          <Button
            onClick={() => globalThis.location?.reload?.()}
            className="mt-4"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* View Tabs and Actions Row */}
        <div className="flex items-center justify-between pt-4 pb-2">
          <TransactionViewTabs currentView="year" year={currentYear} />

          <button
            className="p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            onClick={handleSearchClick}
            aria-label="Search transactions"
          >
            <Search size={20} />
          </button>
        </div>

        {/* Sticky Horizontal Year Selector */}
        <div className="sticky top-0 bg-gray-50 dark:bg-gray-900 z-50 py-2 -mx-6">
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

      {/* Floating Button - Scroll to Top */}
      {showScrollTop && (
        <FloatingButton
          onClick={scrollToTop}
          icon={ArrowUp}
          label="Scroll to top"
          className="transition-all duration-300"
        />
      )}
    </div>
  );
}

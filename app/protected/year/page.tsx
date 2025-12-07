"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUp, Search } from "lucide-react";
import { useYearTransactions } from "@/hooks/useYearTransactions";
import { useAvailableYears } from "@/hooks/useAvailableYears";
import { useBackgroundSync } from "@/hooks/useBackgroundSync";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { HorizontalYearSelector } from "@/components/ui/horizontal-year-selector";
import { Button } from "@/components/ui/button";
import { FloatingButton } from "@/components/ui/floating-button";
import { TransactionViewTabs } from "@/components/ui/transaction-view-tabs";
import { UpdateBanner } from "@/components/ui/update-banner";
import { PullToRefreshIndicator } from "@/components/ui/pull-to-refresh-indicator";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/utils/supabase/client";

import TransactionSummary from "@/components/features/transaction-summary";

export default function YearSummaryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [userId, setUserId] = useState<string | undefined>(undefined);

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

  // Get user ID for background sync
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getUser();
  }, [supabase]);

  const { transactions, isLoading, error, mutate } =
    useYearTransactions(currentYear);
  const { availableYears, isLoading: yearsLoading } = useAvailableYears();

  // Background sync for detecting updates
  const { hasUpdates, updateCount, dismissUpdate, refreshData } =
    useBackgroundSync(userId);

  // Pull-to-refresh functionality
  const { isPulling, pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: async () => {
      await mutate();
    },
  });

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

  /* REMOVED: history.pushState manual handling */
  const handleYearSelect = useCallback((year: number) => {
    // Optimistic update
    setCurrentYear(year);

    const now = new Date();
    const isCurrentYear = year === now.getFullYear();

    if (isCurrentYear) {
      router.push("/protected/year");
    } else {
      router.push(`/protected/year?year=${year}`);
    }
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">
            Error Loading Year Data
          </h2>
          <p className="text-gray-600">{error.message}</p>
          <Button onClick={() => mutate()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
      />

      {hasUpdates && (
        <UpdateBanner
          updateCount={updateCount}
          onRefresh={() => refreshData(mutate)}
          onDismiss={dismissUpdate}
        />
      )}

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
              <Skeleton className="h-12 w-80 rounded-lg" />
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

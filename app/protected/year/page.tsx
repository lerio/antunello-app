"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUp, Search } from "lucide-react";
import { useYearTransactions } from "@/hooks/useYearTransactions";
import { useAvailableYears } from "@/hooks/useAvailableYears";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useYearPrefetch } from "@/hooks/useYearPrefetch";
import { HorizontalYearSelector } from "@/components/ui/horizontal-year-selector";
import { Button } from "@/components/ui/button";
import {
  PageContainer,
  stickyBarClass,
  toolbarIconButtonClass,
} from "@/components/layout/page-container";
import { FloatingButton } from "@/components/ui/floating-button";
import { TransactionViewTabs } from "@/components/ui/transaction-view-tabs";
import { PullToRefreshIndicator } from "@/components/ui/pull-to-refresh-indicator";
import { Skeleton } from "@/components/ui/skeleton";

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

  const { transactions, isLoading, error, mutate } =
    useYearTransactions(currentYear);
  const { availableYears, isLoading: yearsLoading } = useAvailableYears();

  const { prefetchAdjacentYears } = useYearPrefetch();

  // Prefetch adjacent years for instant navigation. Lives here (not in
  // useYearTransactions) so other consumers of that hook — e.g. the
  // transactions page summary — don't trigger full-year prefetch cascades.
  useEffect(() => {
    if (!isLoading && !error) {
      prefetchAdjacentYears(currentYear);
    }
  }, [currentYear, isLoading, error, prefetchAdjacentYears]);

  // Background sync is handled by the provider in the /protected layout
  // (update banner rendered there); no page-level sync state is needed here.

  // Pull-to-refresh functionality
  const { pullDistance, isRefreshing } = usePullToRefresh({
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

      <PageContainer title="Activity">
        {/* View Tabs and Actions Row */}
        <div className="flex items-center justify-between">
          <TransactionViewTabs currentView="year" />

          <div className="flex items-center gap-2">
            <button
              className={toolbarIconButtonClass}
              onClick={handleSearchClick}
              aria-label="Search transactions"
            >
              <Search size={20} />
            </button>
          </div>
        </div>

        {/* Sticky Horizontal Year Selector */}
        <div className={stickyBarClass}>
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
        <div className="mt-2">
          <TransactionSummary
            transactions={transactions}
            isLoading={isLoading}
            currentYear={currentYear}
          />
        </div>
      </PageContainer>

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

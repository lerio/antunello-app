"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { PlusIcon, ChevronLeft, ChevronRight } from "lucide-react";
import dynamic from "next/dynamic";
import { useTransactionsOptimized } from "@/hooks/useTransactionsOptimized";
import { Button } from "@/components/ui/button";

// Lazy load components for better performance
const TransactionsTable = dynamic(() => import("@/components/features/transactions-table-optimized"), {
  loading: () => <div className="animate-pulse h-64 bg-gray-100 rounded-lg" />
});

const MonthSummary = dynamic(() => import("@/components/features/month-summary"), {
  loading: () => <div className="animate-pulse h-32 bg-gray-100 rounded-lg" />
});

export default function ProtectedPage() {
  const router = useRouter();
  const pathname = usePathname();

  // Optimized date parsing from URL
  const currentDate = useMemo(() => {
    if (pathname === "/protected") {
      return new Date();
    }

    const match = pathname.match(/\/protected\/(\d{4})\/(\d{2})/);
    if (match) {
      const [, year, month] = match;
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return isNaN(date.getTime()) ? new Date() : date;
    }

    return new Date();
  }, [pathname]);

  const [isNavigating, setIsNavigating] = useState(false);

  const { transactions, summary, isLoading, error } = useTransactionsOptimized(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1
  );

  const handleAddTransaction = useCallback(() => {
    setIsNavigating(true);
    router.push("/protected/add");
  }, [router]);

  const navigateMonth = useCallback((direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + (direction === "prev" ? -1 : 1));

    const now = new Date();
    const isCurrentMonth = 
      newDate.getMonth() === now.getMonth() && 
      newDate.getFullYear() === now.getFullYear();

    if (isCurrentMonth) {
      router.push("/protected");
    } else {
      const year = newDate.getFullYear();
      const month = (newDate.getMonth() + 1).toString().padStart(2, "0");
      router.push(`/protected/${year}/${month}`);
    }
  }, [currentDate, router]);

  const monthYearString = useMemo(() => {
    return currentDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }, [currentDate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error Loading Transactions</h2>
          <p className="text-gray-600">{error.message}</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Navigation Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border/40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-center items-center gap-4">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => navigateMonth("prev")}
              className="flex-shrink-0"
              aria-label="Previous month"
            >
              <ChevronLeft size={20} />
            </Button>
            
            <h1 className="text-xl font-medium capitalize min-w-[200px] text-center">
              {monthYearString}
            </h1>
            
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => navigateMonth("next")}
              className="flex-shrink-0"
              aria-label="Next month"
            >
              <ChevronRight size={20} />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content - Removed overflow hidden to allow sticky headers */}
      <main className="container mx-auto px-4 py-4 max-w-[800px]">
        <div className="space-y-6">
          <MonthSummary 
            transactions={transactions} 
            isLoading={isLoading} 
          />

          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                  <div className="h-32 bg-gray-100 rounded-lg"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="transactions-table">
              <TransactionsTable transactions={transactions} />
            </div>
          )}
        </div>
      </main>

      {/* Floating Action Button */}
      <Button
        onClick={handleAddTransaction}
        disabled={isNavigating}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 p-0"
        size="icon"
        aria-label="Add transaction"
      >
        <PlusIcon size={24} />
      </Button>
    </div>
  );
}

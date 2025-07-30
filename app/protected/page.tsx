"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { PlusIcon, ChevronLeft, ChevronRight } from "lucide-react";
import TransactionsTable from "@/components/features/transactions-table";
import MonthSummary from "@/components/features/month-summary";
import { useTransactions } from "@/hooks/useTransactions";
import { Button } from "@/components/ui/button";

export default function ProtectedPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);

  // Initialize currentDate based on URL or current date
  const [currentDate, setCurrentDate] = useState(() => {
    // If we're at /protected, use current date
    if (pathname === "/protected") {
      return new Date();
    }

    // Extract year and month from URL like /protected/2024/03
    const match = pathname.match(/\/protected\/(\d{4})\/(\d{2})/);
    if (match) {
      const [_, year, month] = match;
      const date = new Date(parseInt(year), parseInt(month) - 1);

      // Validate the date
      if (isNaN(date.getTime())) {
        return new Date(); // Return current date if invalid
      }
      return date;
    }

    return new Date();
  });

  const { transactions, isLoading } = useTransactions(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1
  );

  // Prefetch the add transaction page and adjacent months
  useEffect(() => {
    router.prefetch("/protected/add");

    // Prefetch next and previous month URLs
    const nextDate = new Date(currentDate);
    nextDate.setMonth(currentDate.getMonth() + 1);
    const prevDate = new Date(currentDate);
    prevDate.setMonth(currentDate.getMonth() - 1);

    const nextYear = nextDate.getFullYear();
    const nextMonth = (nextDate.getMonth() + 1).toString().padStart(2, "0");
    const prevYear = prevDate.getFullYear();
    const prevMonth = (prevDate.getMonth() + 1).toString().padStart(2, "0");

    router.prefetch(`/protected/${nextYear}/${nextMonth}`);
    router.prefetch(`/protected/${prevYear}/${prevMonth}`);
  }, [router, currentDate]);

  const handleAddTransaction = () => {
    setIsNavigating(true);
    router.push("/protected/add");
  };

  const navigateMonth = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    if (direction === "prev") {
      newDate.setMonth(currentDate.getMonth() - 1);
    } else {
      newDate.setMonth(currentDate.getMonth() + 1);
    }

    // If it's current month, use the base URL
    const now = new Date();
    if (
      newDate.getMonth() === now.getMonth() &&
      newDate.getFullYear() === now.getFullYear()
    ) {
      router.push("/protected");
    } else {
      // Otherwise, use the year/month URL
      const year = newDate.getFullYear();
      const month = (newDate.getMonth() + 1).toString().padStart(2, "0");
      router.push(`/protected/${year}/${month}`);
    }

    setCurrentDate(newDate);
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed width container */}
      <div className="fixed-width-container py-6">
        {/* Fixed header section */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-0 mb-4">
          {/* Fixed-width month selector */}
          <div className="flex justify-center items-center gap-4">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => navigateMonth("prev")}
              className="flex-shrink-0 w-10 h-10"
            >
              <ChevronLeft size={20} />
            </Button>
            <div className="w-48 text-center">
              <h2 className="text-xl font-medium capitalize truncate">
                {formatMonthYear(currentDate)}
              </h2>
            </div>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => navigateMonth("next")}
              className="flex-shrink-0 w-10 h-10"
            >
              <ChevronRight size={20} />
            </Button>
          </div>
        </div>

        {/* Content section with consistent layout */}
        <div className="transactions-layout">
          <MonthSummary transactions={transactions} isLoading={isLoading} />

          {isLoading ? (
            <div className="transactions-table">
              <div className="flex justify-center items-center py-12">
                <div className="text-muted-foreground">Loading transactions...</div>
              </div>
            </div>
          ) : (
            <div className="transactions-table">
              <TransactionsTable transactions={transactions} />
            </div>
          )}
        </div>

        {/* Floating Add Transaction Button */}
        <Button
          onClick={handleAddTransaction}
          disabled={isNavigating}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-xl shadow-lg hover:shadow-xl transition-shadow p-0"
          size="icon"
        >
          <PlusIcon size={24} />
        </Button>
      </div>
    </div>
  );
}

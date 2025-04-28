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
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <Button
          onClick={handleAddTransaction}
          disabled={isNavigating}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 cursor-pointer min-w-[160px] justify-center"
        >
          <PlusIcon size={16} />
          {isNavigating ? "Loading..." : "Add Transaction"}
        </Button>
      </div>

      <div className="flex justify-center items-center gap-4 mb-8">
        <button
          onClick={() => navigateMonth("prev")}
          className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 cursor-pointer"
        >
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-xl font-medium capitalize">
          {formatMonthYear(currentDate)}
        </h2>
        <button
          onClick={() => navigateMonth("next")}
          className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 cursor-pointer"
        >
          <ChevronRight size={24} />
        </button>
      </div>

      <MonthSummary transactions={transactions} />

      {isLoading ? (
        <div>Loading transactions...</div>
      ) : (
        <TransactionsTable transactions={transactions} />
      )}
    </div>
  );
}

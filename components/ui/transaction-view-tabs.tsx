"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface TransactionViewTabsProps {
  readonly currentView: "month" | "year";
  readonly year: number;
  readonly month?: number;
}

export function TransactionViewTabs({
  currentView,
  year,
  month,
}: TransactionViewTabsProps) {
  const router = useRouter();

  const handleMonthView = () => {
    const now = new Date();
    const currentMonth = month ?? now.getMonth() + 1;
    const isCurrentMonth =
      currentMonth === now.getMonth() + 1 && year === now.getFullYear();

    const newUrl = isCurrentMonth
      ? "/protected/transactions"
      : `/protected/transactions?year=${year}&month=${currentMonth
          .toString()
          .padStart(2, "0")}`;

    router.push(newUrl);
  };

  const handleYearView = () => {
    const now = new Date();
    const isCurrentYear = year === now.getFullYear();

    const newUrl = isCurrentYear
      ? "/protected/year"
      : `/protected/year?year=${year}`;

    router.push(newUrl);
  };

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={handleMonthView}
        className={cn(
          "text-2xl font-bold transition-colors",
          currentView === "month"
            ? "text-gray-900 dark:text-white"
            : "text-gray-400 dark:text-gray-600"
        )}
      >
        Month
      </button>
      <button
        onClick={handleYearView}
        className={cn(
          "text-2xl font-bold transition-colors",
          currentView === "year"
            ? "text-gray-900 dark:text-white"
            : "text-gray-400 dark:text-gray-600"
        )}
      >
        Year
      </button>
    </div>
  );
}

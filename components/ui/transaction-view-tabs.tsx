"use client";

import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

interface TransactionViewTabsProps {
  readonly currentView: "month" | "year";
  readonly year: number;
  readonly month?: number;
}

const OPTIONS = [
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
] as const;

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
    <div
      role="tablist"
      aria-label="Transaction view"
      className="inline-flex items-center gap-1 rounded-lg bg-muted p-1"
    >
      {OPTIONS.map((option) => {
        const selected = option.value === currentView;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() =>
              option.value === "month" ? handleMonthView() : handleYearView()
            }
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

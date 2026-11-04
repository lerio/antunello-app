"use client";

import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

interface TransactionViewTabsProps {
  readonly currentView: "month" | "year";
}

const OPTIONS = [
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
] as const;

/**
 * The Month / Year switch.
 *
 * Tapping a tab always opens the current period, even when that tab is already
 * selected: a month or year away from today is a detour, and this is the way
 * back. The active tab replaces the history entry so the reset does not leave a
 * duplicate behind; switching views pushes.
 */
export function TransactionViewTabs({ currentView }: TransactionViewTabsProps) {
  const router = useRouter();

  function open(view: "month" | "year") {
    const href = view === "month" ? "/protected/transactions" : "/protected/year";
    if (view === currentView) {
      router.replace(href);
    } else {
      router.push(href);
    }
  }

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
            onClick={() => open(option.value)}
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

"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Home, Banknote, PieChart, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    label: "Home",
    href: "/protected",
    icon: Home,
  },
  {
    label: "Transactions",
    href: "/protected/transactions",
    icon: Banknote,
  },
  {
    label: "Budgets",
    href: "/protected/budgets",
    icon: PieChart,
  },
  {
    label: "Settings",
    href: "/protected/settings",
    icon: Settings,
  },
];

export function MobileNavigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Hide mobile navigation on add/edit transaction pages
  if (!pathname?.startsWith("/protected") ||
    pathname?.startsWith("/protected/add") ||
    pathname?.startsWith("/protected/edit")) {
    return null;
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-around h-14">
        {NAV_ITEMS.map((item) => {
          let isActive = false;

          if (item.label === "Home") {
            // Home is active if we are on /protected AND there are no specific date filters
            isActive = pathname === "/protected" && !searchParams.has("month") && !searchParams.has("year");
          } else if (item.label === "Transactions") {
            isActive = pathname?.startsWith(item.href) || pathname?.startsWith("/protected/year") || pathname?.startsWith("/protected/search") || pathname?.startsWith("/protected/filter") || false;
          } else if (item.label === "Budgets") {
            isActive = pathname?.startsWith(item.href);
          } else if (item.label === "Settings") {
            isActive = pathname?.startsWith(item.href);
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                isActive
                  ? "text-gray-900 dark:text-gray-100"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              )}
            >
              <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function DesktopNavigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Only show in protected area
  if (!pathname?.startsWith("/protected")) return null;

  return (
    <nav className="hidden md:flex items-center space-x-1">
      {NAV_ITEMS.map((item) => {
        let isActive = false;

        if (item.label === "Home") {
          isActive = pathname === "/protected" && !searchParams.has("month") && !searchParams.has("year");
        } else if (item.label === "Transactions") {
          isActive = pathname?.startsWith(item.href) || pathname?.startsWith("/protected/year") || pathname?.startsWith("/protected/search") || pathname?.startsWith("/protected/filter") || false;
        } else { // For Budgets, Settings
          isActive = pathname?.startsWith(item.href);
        }

        return (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "flex items-center space-x-2 text-sm font-medium transition-colors px-3 py-2 rounded-md",
              isActive
                ? "text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
            )}
          >
            <item.icon size={16} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
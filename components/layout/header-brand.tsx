"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * The header's left slot: the page title on Home and Activity where the mobile
 * design puts it, the brand everywhere else. Desktop always keeps the brand,
 * because the desktop nav sits beside it.
 */
const MOBILE_TITLES: Record<string, string> = {
  "/protected": "Home",
  "/protected/transactions": "Activity",
  "/protected/budgets": "Budgets",
  "/protected/budgets/add": "Budgets",
  "/protected/budgets/edit": "Budgets",
  "/protected/settings": "Settings",
  "/protected/funds": "Funds",
};

/** Child screens: a back link to the parent sits beside the mobile title. */
const MOBILE_BACK: Record<string, { href: string; label: string }> = {
  "/protected/funds": { href: "/protected", label: "Back to Home" },
};

export function HeaderBrand() {
  const pathname = usePathname();
  const title = MOBILE_TITLES[pathname];
  const back = MOBILE_BACK[pathname];

  return (
    <>
      {title ? (
        <div className="flex items-center gap-1 md:hidden">
          {back ? (
            <Link
              href={back.href}
              aria-label={back.label}
              className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700"
            >
              <ChevronLeft className="h-6 w-6" />
            </Link>
          ) : null}
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {title}
          </h1>
        </div>
      ) : null}
      <Link
        href="/protected"
        className={cn(
          "flex items-center space-x-4 hover:opacity-80 transition-opacity",
          title && "hidden md:flex",
        )}
      >
        <div className="w-8 h-8 bg-gray-900 dark:bg-gray-100 rounded-full flex items-center justify-center text-white dark:text-gray-900 font-bold text-lg">
          A
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 hidden sm:block">
          Antunello
        </h1>
      </Link>
    </>
  );
}

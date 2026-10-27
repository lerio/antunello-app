"use client";

import Link from "next/link";
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
};

export function HeaderBrand() {
  const pathname = usePathname();
  const title = MOBILE_TITLES[pathname];

  return (
    <>
      {title ? (
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 md:hidden">
          {title}
        </h1>
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

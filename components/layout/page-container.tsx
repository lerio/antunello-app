import * as React from "react";

import { cn } from "@/lib/utils";

/** Sticky period/search bar. Bleeds into the page gutter so its background spans edge to edge. */
export const stickyBarClass =
  "sticky top-0 z-50 -mx-4 bg-gray-50 px-4 py-2 dark:bg-gray-900 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8";

/** Square icon button used in page toolbars. */
export const toolbarIconButtonClass =
  "p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors";

/**
 * Single source of truth for page width, gutters and the space under the
 * header. Every screen renders inside this so edges and offsets line up.
 */
export function PageContainer({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-4xl px-4 pt-4 pb-8 sm:px-6 md:pt-6 lg:px-8",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Vertical stack of cards/sections with the canonical gap. */
export function PageStack({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:gap-6", className)}>
      {children}
    </div>
  );
}

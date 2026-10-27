"use client";

import NetWorthCard from "@/components/features/net-worth-card";
import AtAGlanceCard from "@/components/features/at-a-glance-card";

/**
 * Home answers two questions and no others: is this month on track, and what
 * is everything worth. Everything else lives on the pages you visit on purpose.
 */
export default function HomePage() {
  return (
    <div>
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:max-w-[1200px] lg:px-8">
        <div className="hidden md:flex items-center justify-between pt-4 pb-2">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Home
          </h2>
        </div>

        {/* 7/5 on desktop: net worth gets the wider column for its chart. */}
        <div className="grid grid-cols-1 items-start gap-4 py-2 sm:py-6 lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-7">
            <NetWorthCard />
          </div>
          <div className="lg:col-span-5">
            <AtAGlanceCard />
          </div>
        </div>
      </div>
    </div>
  );
}

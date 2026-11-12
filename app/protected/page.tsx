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
      <div className="mx-auto max-w-3xl px-4 sm:px-6 md:pb-8 lg:px-8">
        <h2 className="hidden md:block pt-4 text-2xl font-bold text-gray-900 dark:text-white">
          Home
        </h2>

        <div className="grid grid-cols-1 gap-6 py-2 sm:py-6">
          <div>
            <NetWorthCard />
          </div>
          <div>
            <AtAGlanceCard />
          </div>
        </div>
      </div>
    </div>
  );
}

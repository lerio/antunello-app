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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between pt-4 pb-2">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Home
          </h2>
        </div>

        <div className="py-2 sm:py-6">
          <AtAGlanceCard />
        </div>

        <div className="py-2 sm:py-6">
          <NetWorthCard />
        </div>
      </div>
    </div>
  );
}

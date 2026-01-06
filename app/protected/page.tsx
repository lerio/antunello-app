"use client";

import Balance from "@/components/features/balance";
import BalanceChart from "@/components/features/balance-chart";

import DashboardSummary from "@/components/features/dashboard-summary";
import { useDashboardComparison } from "@/hooks/useDashboardComparison";

export default function HomePage() {
  const { current, prev, lastYear, isLoading } = useDashboardComparison();

  return (
    <div>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* View Tabs Row */}
        <div className="flex items-center justify-between pt-4 pb-2">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Home
            </h2>
          </div>

          {/* Placeholder to match search button height */}
          <div
            className="p-4.5 border border-transparent rounded-lg w-9 h-9"
            aria-hidden="true"
          ></div>
        </div>

        {/* Balance Component with consistent styling */}
        <div className="py-2 sm:py-6">
          <Balance />
        </div>

        {/* Balance Over Time Chart */}
        <div className="py-2 sm:py-6">
          <BalanceChart />
        </div>

        {/* Gains/Losses and Breakdown */}
        <div className="py-2 sm:py-6">
          <DashboardSummary
            current={current}
            prev={prev}
            lastYear={lastYear}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}

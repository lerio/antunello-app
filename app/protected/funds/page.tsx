"use client";

import FundList from "@/components/features/fund-list";

export default function FundsPage() {
  return (
    <div>
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between pt-4 pb-2">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Funds
          </h2>
        </div>

        <div className="py-2 sm:py-6">
          <FundList />
        </div>
      </div>
    </div>
  );
}

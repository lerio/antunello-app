"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LucideProps } from "lucide-react";
import { CATEGORY_ICONS } from "@/utils/categories";
import { MAIN_CATEGORIES, SUB_CATEGORIES, getCategoryType } from "@/types/database";
import CategoryChart from "@/components/features/category-chart";
import TransactionsTable from "@/components/features/transactions-table-optimized";
import { useCategoryTransactions, type TimeRange } from "@/hooks/useCategoryTransactions";

export default function SubCategoryPage({
  params,
}: Readonly<{
  params: Promise<{ category: string; subcategory: string }>;
}>) {
  const router = useRouter();
  const resolvedParams = use(params);
  const [timeRange, setTimeRange] = useState<TimeRange>("1m");

  // Decode URL-encoded names
  const category = decodeURIComponent(resolvedParams.category);
  const subCategory = decodeURIComponent(resolvedParams.subcategory);

  // Validate category and subcategory exist
  const isValidCategory = MAIN_CATEGORIES.includes(category);
  const validSubCategories = SUB_CATEGORIES[category] || [];
  const isValidSubCategory = validSubCategories.includes(subCategory);
  const categoryType = getCategoryType(category);

  // Get icon component (cast to LucideProps type for proper prop support)
  const Icon = (CATEGORY_ICONS[category] || CATEGORY_ICONS["Services"]) as React.ComponentType<LucideProps>;

  // Fetch transactions for the list view
  const { transactions, isLoading } = useCategoryTransactions(timeRange, category, subCategory);

  if (!isValidCategory || !isValidSubCategory) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">
            {!isValidCategory ? "Category Not Found" : "Subcategory Not Found"}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {!isValidCategory
              ? `The category "${category}" does not exist.`
              : `The subcategory "${subCategory}" does not exist in "${category}".`}
          </p>
          <button
            onClick={() => router.back()}
            className="text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with subcategory info */}
        <div className="flex items-center pt-4 pb-2 min-w-0">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            {/* Category icon and subcategory name */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Link
                href={`/protected/category/${encodeURIComponent(category)}`}
                className="shrink-0 w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <Icon size={20} className="text-gray-600 dark:text-gray-400" />
              </Link>
              <h2
                className="text-2xl font-bold text-gray-900 dark:text-white whitespace-nowrap overflow-hidden flex-1"
                style={{ maskImage: 'linear-gradient(to right, black calc(100% - 48px), transparent 100%)', WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 48px), transparent 100%)' }}
              >
                {subCategory}
              </h2>
            </div>
          </div>
        </div>

        {/* Category Chart with subcategory filter */}
        <div className="py-2 sm:py-6">
          <CategoryChart
            category={category}
            subCategory={subCategory}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
          />
        </div>

        {/* Transactions List */}
        <div className="pb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 px-1">
            Transactions
          </h3>
          <TransactionsTable
            transactions={transactions}
            isLoading={isLoading}
            showYear={timeRange !== '1m'}
          />
        </div>
      </div>
    </div>
  );
}

import { Transaction, getCategoryType } from "@/types/database";
import { formatCurrency } from "@/utils/currency";
import { CATEGORY_ICONS } from "@/utils/categories";
import { LucideProps } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CurrencyTotals = {
  [currency: string]: number;
};

type CategoryTotals = {
  [category: string]: {
    [currency: string]: number;
  };
};

type MonthSummaryProps = {
  transactions: Transaction[];
  isLoading?: boolean;
};

export default function MonthSummary({
  transactions,
  isLoading = false,
}: MonthSummaryProps) {
  // Use EUR as the unified currency for all calculations
  let expenseTotal = 0;
  let incomeTotal = 0;
  const incomeCategoryTotals: Record<string, number> = {};
  const expenseCategoryTotals: Record<string, number> = {};

  // Calculate totals using EUR amounts
  transactions.forEach((transaction) => {
    // Use EUR amount if available, otherwise fall back to original amount (assuming EUR)
    const eurAmount =
      transaction.eur_amount ||
      (transaction.currency === "EUR" ? transaction.amount : 0);

    // Skip transactions without EUR conversion (to avoid incorrect totals)
    if (eurAmount === 0 && transaction.currency !== "EUR") {
      return;
    }

    // Update expense/income totals
    if (transaction.type === "expense") {
      expenseTotal += eurAmount;
      // Update expense category totals
      if (!expenseCategoryTotals[transaction.main_category]) {
        expenseCategoryTotals[transaction.main_category] = 0;
      }
      expenseCategoryTotals[transaction.main_category] += eurAmount;
    } else {
      incomeTotal += eurAmount;
      // Update income category totals
      if (!incomeCategoryTotals[transaction.main_category]) {
        incomeCategoryTotals[transaction.main_category] = 0;
      }
      incomeCategoryTotals[transaction.main_category] += eurAmount;
    }
  });

  // Calculate balance
  const balanceTotal = incomeTotal - expenseTotal;

  const LoadingSkeleton = () => (
    <div className="w-full">
      {/* Loading skeleton for category breakdown */}
      <Card className="category-breakdown">
        <CardContent className="w-full pt-4">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 gap-3"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="h-4 w-4 bg-gray-300 dark:bg-gray-700 rounded animate-pulse"></div>
                  <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded animate-pulse w-20"></div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded animate-pulse w-14"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="w-full">
      {/* Category breakdown with consistent layout */}
      <Card className="category-breakdown">
        <CardContent className="w-full pt-4">
          {Object.keys(incomeCategoryTotals).length > 0 ||
          Object.keys(expenseCategoryTotals).length > 0 ? (
            <div className="space-y-6">
              {/* Balance Row */}
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Balance
                </h4>
                <span className={`text-sm font-semibold ${balanceTotal >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrency(Math.abs(balanceTotal), "EUR")}
                </span>
              </div>

              {/* Income Categories */}
              {Object.keys(incomeCategoryTotals).length > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-semibold text-green-700 dark:text-green-300">
                      Income
                    </h4>
                    <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                      {formatCurrency(incomeTotal, "EUR")}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(incomeCategoryTotals)
                      .sort(([, a], [, b]) => b - a) // Sort by amount (highest to lowest)
                      .map(([category, amount]) => {
                        const Icon = CATEGORY_ICONS[category];
                        return (
                          <div
                            key={category}
                            className="flex items-center justify-between py-2 gap-3"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Icon
                                {...({
                                  size: 16,
                                  className:
                                    "text-gray-500 dark:text-gray-400 flex-shrink-0",
                                } as LucideProps)}
                              />
                              <span className="font-medium text-gray-700 dark:text-gray-300 text-sm truncate">
                                {category}
                              </span>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="font-normal text-sm text-green-600 dark:text-green-400">
                                {formatCurrency(amount, "EUR")}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Expense Categories */}
              {Object.keys(expenseCategoryTotals).length > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-semibold text-red-700 dark:text-red-300">
                      Expenses
                    </h4>
                    <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                      {formatCurrency(expenseTotal, "EUR")}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(expenseCategoryTotals)
                      .sort(([, a], [, b]) => b - a) // Sort by amount (highest to lowest)
                      .map(([category, amount]) => {
                        const Icon = CATEGORY_ICONS[category];
                        return (
                          <div
                            key={category}
                            className="flex items-center justify-between py-2 gap-3"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Icon
                                {...({
                                  size: 16,
                                  className:
                                    "text-gray-500 dark:text-gray-400 flex-shrink-0",
                                } as LucideProps)}
                              />
                              <span className="font-medium text-gray-700 dark:text-gray-300 text-sm truncate">
                                {category}
                              </span>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="font-normal text-sm text-red-600 dark:text-red-400">
                                {formatCurrency(amount, "EUR")}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No transactions this month
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

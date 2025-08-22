import { useState } from "react";
import { Transaction, getCategoryType } from "@/types/database";
import { formatCurrency } from "@/utils/currency";
import { CATEGORY_ICONS } from "@/utils/categories";
import { LucideProps, ChevronDown, ChevronRight, EyeOff, Info } from "lucide-react";
import { HiddenTransactionsTooltip } from "@/components/ui/hidden-transactions-tooltip";

type CurrencyTotals = {
  [currency: string]: number;
};

type CategoryTotals = {
  [category: string]: {
    [currency: string]: number;
  };
};

type TransactionSummaryProps = {
  transactions: Transaction[];
  isLoading?: boolean;
  includeHiddenInTotals?: boolean;
};

export default function TransactionSummary({
  transactions,
  isLoading = false,
  includeHiddenInTotals = false,
}: TransactionSummaryProps) {
  // State for collapsible sections (default collapsed)
  const [isIncomeExpanded, setIsIncomeExpanded] = useState(false);
  const [isExpensesExpanded, setIsExpensesExpanded] = useState(false);

  // Use EUR as the unified currency for all calculations
  let expenseTotal = 0;
  let incomeTotal = 0;
  const incomeCategoryTotals: Record<string, number> = {};
  const expenseCategoryTotals: Record<string, number> = {};
  
  // Track hidden transactions
  let hiddenExpenseTotal = 0;
  let hiddenIncomeTotal = 0;
  let hiddenTransactionCount = 0;

  // Calculate totals using EUR amounts
  transactions.forEach((transaction) => {
    // Skip transactions without eur_amount (they haven't been converted)
    if (transaction.eur_amount === null || transaction.eur_amount === undefined) {
      return;
    }

    const eurAmount = transaction.eur_amount;

    // Handle hidden transactions
    if (transaction.hide_from_totals) {
      hiddenTransactionCount++;
      if (transaction.type === "expense") {
        hiddenExpenseTotal += eurAmount;
      } else {
        hiddenIncomeTotal += eurAmount;
      }
      
      // If we're not including hidden transactions in totals, skip to next transaction
      if (!includeHiddenInTotals) {
        return;
      }
    }

    // Update expense/income totals (includes hidden transactions if includeHiddenInTotals is true)
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
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-8">
      <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded animate-pulse w-20"></div>
        <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded animate-pulse w-24"></div>
      </div>
      <div className="mt-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 bg-gray-300 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded animate-pulse w-16"></div>
            </div>
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded animate-pulse w-20"></div>
          </div>
        ))}
      </div>
    </div>
  );

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-8">
      {Object.keys(incomeCategoryTotals).length > 0 ||
      Object.keys(expenseCategoryTotals).length > 0 ? (
        <>
          {/* Balance Row */}
          <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <span className="text-lg font-medium text-gray-600 dark:text-gray-400">Balance</span>
              {!includeHiddenInTotals && hiddenTransactionCount > 0 && (
                <HiddenTransactionsTooltip 
                  count={hiddenTransactionCount}
                  hiddenIncomeTotal={hiddenIncomeTotal}
                  hiddenExpenseTotal={hiddenExpenseTotal}
                />
              )}
            </div>
            <span className={`text-lg font-bold ${balanceTotal >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatCurrency(Math.abs(balanceTotal), "EUR")}
            </span>
          </div>

          <div className="mt-4 space-y-4">
            {/* Income Categories */}
            {Object.keys(incomeCategoryTotals).length > 0 && (
              <div>
                <div 
                  className="flex justify-between items-center cursor-pointer"
                  onClick={() => setIsIncomeExpanded(!isIncomeExpanded)}
                >
                  <div className="flex items-center">
                    {isIncomeExpanded ? (
                      <ChevronDown size={20} className="text-green-500" />
                    ) : (
                      <ChevronRight size={20} className="text-green-500" />
                    )}
                    <span className="ml-2 font-medium text-gray-800 dark:text-gray-200">Income</span>
                  </div>
                  <span className="font-medium text-green-500">
                    {formatCurrency(incomeTotal, "EUR")}
                  </span>
                </div>
                
                {isIncomeExpanded && (
                  <div className="pl-8 mt-3 space-y-3">
                    {Object.entries(incomeCategoryTotals)
                      .sort(([, a], [, b]) => b - a)
                      .map(([category, amount]) => {
                        const Icon = CATEGORY_ICONS[category];
                        return (
                          <div key={category} className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                            <div className="flex items-center">
                              <Icon {...({ size: 20, className: "text-gray-400 dark:text-gray-500" } as LucideProps)} />
                              <span className="ml-3">{category}</span>
                            </div>
                            <span>{formatCurrency(amount, "EUR")}</span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {/* Expense Categories */}
            {Object.keys(expenseCategoryTotals).length > 0 && (
              <div>
                <div 
                  className="flex justify-between items-center cursor-pointer"
                  onClick={() => setIsExpensesExpanded(!isExpensesExpanded)}
                >
                  <div className="flex items-center">
                    {isExpensesExpanded ? (
                      <ChevronDown size={20} className="text-red-500" />
                    ) : (
                      <ChevronRight size={20} className="text-red-500" />
                    )}
                    <span className="ml-2 font-medium text-gray-800 dark:text-gray-200">Expenses</span>
                  </div>
                  <span className="font-medium text-red-500">
                    {formatCurrency(expenseTotal, "EUR")}
                  </span>
                </div>

                {isExpensesExpanded && (
                  <div className="pl-8 mt-3 space-y-3">
                    {Object.entries(expenseCategoryTotals)
                      .sort(([, a], [, b]) => b - a)
                      .map(([category, amount]) => {
                        const Icon = CATEGORY_ICONS[category];
                        return (
                          <div key={category} className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                            <div className="flex items-center">
                              <Icon {...({ size: 20, className: "text-gray-400 dark:text-gray-500" } as LucideProps)} />
                              <span className="ml-3">{category}</span>
                            </div>
                            <span>{formatCurrency(amount, "EUR")}</span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No transactions this month
        </div>
      )}
    </div>
  );
}

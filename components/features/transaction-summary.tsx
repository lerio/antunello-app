import React from "react";
import { Transaction, getCategoryType } from "@/types/database";
import { formatCurrency } from "@/utils/currency";
import { CATEGORY_ICONS } from "@/utils/categories";
import { LucideProps, EyeOff, Info } from "lucide-react";
import { HiddenTransactionsTooltip } from "@/components/ui/hidden-transactions-tooltip";
import { useYearTransactions } from "@/hooks/useYearTransactions";

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
  currentYear?: number;
};

export default function TransactionSummary({
  transactions,
  isLoading = false,
  includeHiddenInTotals = false,
  currentYear,
}: TransactionSummaryProps) {

  // Fetch previous year data for comparison if currentYear is provided
  const previousYear = currentYear ? currentYear - 1 : undefined;
  const { transactions: previousYearTransactions } = useYearTransactions(previousYear || 0);
  
  // Use EUR as the unified currency for all calculations
  let expenseTotal = 0;
  let incomeTotal = 0;
  const incomeCategoryTotals: Record<string, number> = {};
  const expenseCategoryTotals: Record<string, number> = {};
  
  // Track previous year totals for comparison
  let prevYearExpenseTotal = 0;
  let prevYearIncomeTotal = 0;
  const prevYearIncomeCategoryTotals: Record<string, number> = {};
  const prevYearExpenseCategoryTotals: Record<string, number> = {};
  
  // Track hidden transactions separately (these will be shown separately and not included in main totals)
  let hiddenExpenseTotal = 0;
  let hiddenIncomeTotal = 0;
  let hiddenTransactionCount = 0;
  let prevYearHiddenExpenseTotal = 0;
  let prevYearHiddenIncomeTotal = 0;

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
      // Skip hidden transactions - they should never be included in main totals
      return;
    }

    // Update expense/income totals (excludes hidden transactions)
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

  // Calculate previous year totals if data is available
  if (previousYearTransactions && previousYearTransactions.length > 0) {
    previousYearTransactions.forEach((transaction) => {
      if (transaction.eur_amount === null || transaction.eur_amount === undefined) {
        return;
      }
      
      const eurAmount = transaction.eur_amount;
      
      // Handle hidden transactions for previous year
      if (transaction.hide_from_totals) {
        if (transaction.type === "expense") {
          prevYearHiddenExpenseTotal += eurAmount;
        } else {
          prevYearHiddenIncomeTotal += eurAmount;
        }
        // Skip hidden transactions - they should never be included in main totals
        return;
      }
      
      if (transaction.type === "expense") {
        prevYearExpenseTotal += eurAmount;
        if (!prevYearExpenseCategoryTotals[transaction.main_category]) {
          prevYearExpenseCategoryTotals[transaction.main_category] = 0;
        }
        prevYearExpenseCategoryTotals[transaction.main_category] += eurAmount;
      } else {
        prevYearIncomeTotal += eurAmount;
        if (!prevYearIncomeCategoryTotals[transaction.main_category]) {
          prevYearIncomeCategoryTotals[transaction.main_category] = 0;
        }
        prevYearIncomeCategoryTotals[transaction.main_category] += eurAmount;
      }
    });
  }
  
  // Calculate balance
  const balanceTotal = incomeTotal - expenseTotal;
  const prevYearBalanceTotal = prevYearIncomeTotal - prevYearExpenseTotal;
  
  // Helper function to calculate monthly average
  const getMonthlyAverage = (total: number, year?: number) => {
    if (year && year === new Date().getFullYear()) {
      // For current year, use completed months only
      const currentMonth = new Date().getMonth(); // 0-based (0 = January, 8 = September)
      const completedMonths = currentMonth; // August (8th month) = 8 completed months (0-7)
      return completedMonths > 0 ? total / completedMonths : total;
    }
    // For previous years, use full 12 months
    return total / 12;
  };
  
  // Helper function to calculate difference from previous year average
  const getDifferenceFromPrevYear = (currentTotal: number, prevYearTotal: number, isBalance: boolean = false) => {
    const currentMonthlyAvg = getMonthlyAverage(currentTotal, currentYear);
    const prevYearMonthlyAvg = getMonthlyAverage(prevYearTotal, previousYear);
    
    if (isBalance) {
      // For balance: show the change from previous year to current year
      // If balance got worse (decreased), show negative
      // If balance got better (increased), show positive
      return currentMonthlyAvg - prevYearMonthlyAvg;
    }
    
    return currentMonthlyAvg - prevYearMonthlyAvg;
  };
  
  // Helper function to format difference with color
  const formatDifference = (difference: number, isIncome: boolean = false) => {
    const isPositive = difference > 0;
    let colorClass;
    
    if (isIncome) {
      // For income: positive difference is good (green), negative is bad (red)
      colorClass = isPositive ? 'text-green-500' : 'text-red-500';
    } else {
      // For expenses: positive difference is bad (red), negative is good (green)
      colorClass = isPositive ? 'text-red-500' : 'text-green-500';
    }
    
    const sign = isPositive ? '+' : '-';
    return (
      <span className={colorClass}>
        {sign}{formatCurrency(Math.abs(difference), "EUR")}
      </span>
    );
  };

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

  // Prepare totals data
  const totalsData = [
    {
      category: 'Balance',
      total: balanceTotal,
      monthlyAverage: getMonthlyAverage(balanceTotal, currentYear),
      difference: currentYear && previousYear ? getDifferenceFromPrevYear(balanceTotal, prevYearBalanceTotal, true) : null,
      isBalance: true
    },
    {
      category: 'Income',
      total: incomeTotal,
      monthlyAverage: getMonthlyAverage(incomeTotal, currentYear),
      difference: currentYear && previousYear ? getDifferenceFromPrevYear(incomeTotal, prevYearIncomeTotal) : null,
      isIncome: true
    },
    {
      category: 'Expenses',
      total: expenseTotal,
      monthlyAverage: getMonthlyAverage(expenseTotal, currentYear),
      difference: currentYear && previousYear ? getDifferenceFromPrevYear(expenseTotal, prevYearExpenseTotal) : null,
      isExpense: true
    },
    // Add Hidden Expenses row if there are any hidden expenses
    ...(hiddenExpenseTotal > 0 ? [{
      category: 'Hidden Expenses',
      total: hiddenExpenseTotal,
      monthlyAverage: getMonthlyAverage(hiddenExpenseTotal, currentYear),
      difference: currentYear && previousYear ? getDifferenceFromPrevYear(hiddenExpenseTotal, prevYearHiddenExpenseTotal) : null,
      isHiddenExpense: true
    }] : [])
  ];

  // Prepare categories data
  const categoriesData: Array<{
    type: 'income' | 'expense';
    category: string;
    icon: React.ComponentType<LucideProps>;
    monthlyAverage: number;
    difference: number | null;
  }> = [];
  
  // Add Income categories
  if (Object.keys(incomeCategoryTotals).length > 0) {
    Object.entries(incomeCategoryTotals)
      .sort(([, a], [, b]) => b - a)
      .forEach(([category, amount]) => {
        const prevYearAmount = prevYearIncomeCategoryTotals[category] || 0;
        categoriesData.push({
          type: 'income',
          category,
          icon: CATEGORY_ICONS[category],
          monthlyAverage: getMonthlyAverage(amount, currentYear),
          difference: currentYear && previousYear ? getDifferenceFromPrevYear(amount, prevYearAmount) : null
        });
      });
  }
  
  // Add Expense categories
  if (Object.keys(expenseCategoryTotals).length > 0) {
    Object.entries(expenseCategoryTotals)
      .sort(([, a], [, b]) => b - a)
      .forEach(([category, amount]) => {
        const prevYearAmount = prevYearExpenseCategoryTotals[category] || 0;
        categoriesData.push({
          type: 'expense',
          category,
          icon: CATEGORY_ICONS[category],
          monthlyAverage: getMonthlyAverage(amount, currentYear),
          difference: currentYear && previousYear ? getDifferenceFromPrevYear(amount, prevYearAmount) : null
        });
      });
  }

  const hasData = Object.keys(incomeCategoryTotals).length > 0 || Object.keys(expenseCategoryTotals).length > 0;

  return (
    <div className="space-y-6 mb-8">
      {hasData ? (
        <>
          
          {/* Totals Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Totals</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-2 font-medium text-gray-600 dark:text-gray-400">Category</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-600 dark:text-gray-400">Total</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-600 dark:text-gray-400">Monthly Avg</th>
                    {currentYear && previousYear && (
                      <th className="text-right py-3 px-2 font-medium text-gray-600 dark:text-gray-400">
                        vs {previousYear} Avg
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {totalsData.map((item) => {
                    const isHiddenExpense = item.isHiddenExpense;
                    return (
                      <tr key={item.category} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                        <td className="py-3 px-2">
                          <span className={`${
                            isHiddenExpense 
                              ? 'text-sm text-red-600 dark:text-red-400 ml-4'
                              : item.isBalance 
                              ? 'font-medium text-lg text-gray-800 dark:text-gray-200'
                              : item.isIncome
                              ? 'font-medium text-green-600 dark:text-green-400'
                              : 'font-medium text-red-600 dark:text-red-400'
                          }`}>
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className={`${
                            isHiddenExpense
                              ? 'text-sm text-red-500'
                              : item.isBalance 
                              ? `font-medium text-lg ${item.total >= 0 ? 'text-green-500' : 'text-red-500'}`
                              : item.isIncome
                              ? 'font-medium text-green-500'
                              : 'font-medium text-red-500'
                          }`}>
                            {item.isBalance && item.total < 0 ? '-' : ''}{formatCurrency(Math.abs(item.total), "EUR")}
                          </span>
                        </td>
                        {/* Hidden expenses don't show monthly average */}
                        {!isHiddenExpense && (
                          <td className="py-3 px-2 text-right">
                            <span className={`${
                              item.isBalance 
                                ? `${item.monthlyAverage >= 0 ? 'text-green-500' : 'text-red-500'}`
                                : item.isIncome
                                ? 'text-green-500'
                                : 'text-red-500'
                            }`}>
                              {item.isBalance && item.monthlyAverage < 0 ? '-' : ''}{formatCurrency(Math.abs(item.monthlyAverage), "EUR")}
                            </span>
                          </td>
                        )}
                        {isHiddenExpense && (
                          <td className="py-3 px-2 text-right">
                            <span className="text-gray-400 dark:text-gray-500">-</span>
                          </td>
                        )}
                        {/* Hidden expenses don't show vs previous year comparison */}
                        {currentYear && previousYear && !isHiddenExpense && (
                          <td className="py-3 px-2 text-right">
                            {item.difference !== null ? (
                              formatDifference(item.difference, item.isIncome || item.isBalance)
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500">-</span>
                            )}
                          </td>
                        )}
                        {currentYear && previousYear && isHiddenExpense && (
                          <td className="py-3 px-2 text-right">
                            <span className="text-gray-400 dark:text-gray-500">-</span>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Categories Table */}
          {categoriesData.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Category Breakdown</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-2 font-medium text-gray-600 dark:text-gray-400">Category</th>
                      <th className="text-right py-3 px-2 font-medium text-gray-600 dark:text-gray-400">Monthly Avg</th>
                      {currentYear && previousYear && (
                        <th className="text-right py-3 px-2 font-medium text-gray-600 dark:text-gray-400">
                          vs {previousYear} Avg
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {categoriesData.map((item) => (
                      <tr key={`${item.type}-${item.category}`} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                        <td className="py-3 px-2">
                          <div className="flex items-center">
                            <item.icon {...({ size: 20, className: "text-gray-400 dark:text-gray-500 mr-3" } as LucideProps)} />
                            <span className={`font-medium ${
                              item.type === 'income'
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {item.category}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className={`${
                            item.type === 'income' ? 'text-green-500' : 'text-red-500'
                          }`}>
                            {formatCurrency(Math.abs(item.monthlyAverage), "EUR")}
                          </span>
                        </td>
                        {currentYear && previousYear && (
                          <td className="py-3 px-2 text-right">
                            {item.difference !== null ? (
                              formatDifference(item.difference, item.type === 'income')
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500">-</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No transactions this year
          </div>
        </div>
      )}
    </div>
  );
}

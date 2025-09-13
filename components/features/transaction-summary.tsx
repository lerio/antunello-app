import React, { useState } from "react";
import { Transaction, getCategoryType } from "@/types/database";
import { formatCurrency } from "@/utils/currency";
import { CATEGORY_ICONS } from "@/utils/categories";
import { LucideProps, EyeOff, Info, ChevronDown, ChevronRight } from "lucide-react";
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

type CategoryData = {
  type: 'income' | 'expense';
  category: string;
  icon: React.ComponentType<LucideProps>;
  total: number;
  monthlyAverage: number;
  difference: number | null;
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

  // State for collapsible categories in monthly view
  const [isIncomeExpanded, setIsIncomeExpanded] = useState(false);
  const [isExpensesExpanded, setIsExpensesExpanded] = useState(false);

  // Fetch previous year data for comparison if currentYear is provided
  const previousYear = currentYear ? currentYear - 1 : undefined;
  const { transactions: previousYearTransactions } = useYearTransactions(previousYear);
  
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
  
  // Helper function to format amounts without currency symbol
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
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
      <span className={`${colorClass} text-sm sm:text-sm`}>
        {sign}{formatAmount(Math.abs(difference))}
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

  // Prepare totals data with categories for monthly view
  const createTotalsData = () => {
    const baseData = [
      {
        category: balanceTotal >= 0 ? 'Gains' : 'Losses',
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
        isIncome: true,
        isCollapsible: !currentYear
      },
      {
        category: 'Expenses',
        total: expenseTotal,
        monthlyAverage: getMonthlyAverage(expenseTotal, currentYear),
        difference: currentYear && previousYear ? getDifferenceFromPrevYear(expenseTotal, prevYearExpenseTotal) : null,
        isExpense: true,
        isCollapsible: !currentYear
      },
      // Add Hidden Expenses row if there are any hidden expenses
      ...(hiddenExpenseTotal > 0 ? [{
        category: 'Hidden',
        total: hiddenExpenseTotal,
        monthlyAverage: getMonthlyAverage(hiddenExpenseTotal, currentYear),
        difference: currentYear && previousYear ? getDifferenceFromPrevYear(hiddenExpenseTotal, prevYearHiddenExpenseTotal) : null,
        isHiddenExpense: true
      }] : [])
    ];

    // In monthly view, add category breakdowns under Income and Expenses
    if (!currentYear) {
      const extendedData: any[] = [];
      
      for (const item of baseData) {
        extendedData.push(item);
        
        // Add income categories after Income row
        if (item.isIncome && isIncomeExpanded) {
          Object.entries(incomeCategoryTotals)
            .sort(([, a], [, b]) => b - a)
            .forEach(([category, amount]) => {
              extendedData.push({
                category,
                total: amount,
                monthlyAverage: getMonthlyAverage(amount, currentYear),
                difference: null,
                isSubCategory: true,
                type: 'income',
                icon: CATEGORY_ICONS[category]
              });
            });
        }
        
        // Add expense categories after Expenses row
        if (item.isExpense && isExpensesExpanded) {
          Object.entries(expenseCategoryTotals)
            .sort(([, a], [, b]) => b - a)
            .forEach(([category, amount]) => {
              extendedData.push({
                category,
                total: amount,
                monthlyAverage: getMonthlyAverage(amount, currentYear),
                difference: null,
                isSubCategory: true,
                type: 'expense',
                icon: CATEGORY_ICONS[category]
              });
            });
        }
      }
      
      return extendedData;
    }
    
    return baseData;
  };

  const totalsData = createTotalsData();

  // Prepare categories data
  const categoriesData: CategoryData[] = [];
  
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
          total: amount,
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
          total: amount,
          monthlyAverage: getMonthlyAverage(amount, currentYear),
          difference: currentYear && previousYear ? getDifferenceFromPrevYear(amount, prevYearAmount) : null
        });
      });
  }

  const hasData = Object.keys(incomeCategoryTotals).length > 0 || Object.keys(expenseCategoryTotals).length > 0;

  return (
    <div className="space-y-4 sm:space-y-6 mb-6 sm:mb-8">
      {hasData ? (
        <>
          
          {/* Totals Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 sm:mb-4">Totals (€)</h3>
            <div className="overflow-hidden">
              <table className="w-full">
                {currentYear && (
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 sm:py-3 px-1 sm:px-2 font-medium text-gray-600 dark:text-gray-400 text-sm sm:text-sm"></th>
                      <th className="text-right py-2 sm:py-3 px-1 sm:px-2 font-medium text-gray-600 dark:text-gray-400 text-sm sm:text-sm">Total</th>
                      <th className="text-right py-2 sm:py-3 px-1 sm:px-2 font-medium text-gray-600 dark:text-gray-400 text-sm sm:text-sm">Monthly</th>
                      {previousYear && (
                        <th className="text-right py-2 sm:py-3 px-1 sm:px-2 font-medium text-gray-600 dark:text-gray-400 text-sm sm:text-sm">
                          vs {previousYear}
                        </th>
                      )}
                    </tr>
                  </thead>
                )}
                <tbody>
                  {totalsData.map((item, index) => {
                    const isHiddenExpense = item.isHiddenExpense;
                    const isSubCategory = item.isSubCategory;
                    const isCollapsible = item.isCollapsible;
                    
                    return (
                      <tr key={`${item.category}-${index}`} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                        <td className="py-2 sm:py-3 px-1 sm:px-2">
                          <div className="flex items-center">
                            {isCollapsible && (
                              <button
                                onClick={() => {
                                  if (item.isIncome) {
                                    setIsIncomeExpanded(!isIncomeExpanded);
                                  } else if (item.isExpense) {
                                    setIsExpensesExpanded(!isExpensesExpanded);
                                  }
                                }}
                                className="mr-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                              >
                                {item.isIncome && isIncomeExpanded ? 
                                  <ChevronDown size={16} className="text-gray-600 dark:text-gray-400" /> : 
                                  item.isExpense && isExpensesExpanded ?
                                  <ChevronDown size={16} className="text-gray-600 dark:text-gray-400" /> :
                                  <ChevronRight size={16} className="text-gray-600 dark:text-gray-400" />
                                }
                              </button>
                            )}
                            {isSubCategory && item.icon && (
                              <item.icon size={16} className="text-gray-400 dark:text-gray-500 mr-2" />
                            )}
                            <span className={`${
                              isSubCategory 
                                ? `text-sm sm:text-sm ml-4 ${item.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`
                                : isHiddenExpense 
                                ? 'text-sm sm:text-sm text-red-600 dark:text-red-400 ml-2 sm:ml-4'
                                : item.isBalance 
                                ? `font-medium text-sm sm:text-sm ${item.total >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`
                                : item.isIncome
                                ? 'font-medium text-sm sm:text-sm text-green-600 dark:text-green-400'
                                : 'font-medium text-sm sm:text-sm text-red-600 dark:text-red-400'
                            }`}>
                              {item.category}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 px-1 sm:px-2 text-right">
                          <span className={`${
                            isSubCategory
                              ? `text-sm sm:text-sm ${item.type === 'income' ? 'text-green-500' : 'text-red-500'}`
                              : isHiddenExpense
                              ? 'text-sm sm:text-sm text-red-500'
                              : item.isBalance 
                              ? `font-medium text-sm sm:text-sm ${item.total >= 0 ? 'text-green-500' : 'text-red-500'}`
                              : item.isIncome
                              ? 'font-medium text-sm sm:text-sm text-green-500'
                              : 'font-medium text-sm sm:text-sm text-red-500'
                          }`}>
                            {formatAmount(Math.abs(item.total))}
                          </span>
                        </td>
                        {/* Monthly column only in year view */}
                        {currentYear && (
                          <>
                            {!isHiddenExpense ? (
                              <td className="py-2 sm:py-3 px-1 sm:px-2 text-right">
                                <span className={`text-sm sm:text-sm ${
                                  item.isBalance 
                                    ? `${item.monthlyAverage >= 0 ? 'text-green-500' : 'text-red-500'}`
                                    : item.isIncome
                                    ? 'text-green-500'
                                    : 'text-red-500'
                                }`}>
                                  {formatAmount(Math.abs(item.monthlyAverage))}
                                </span>
                              </td>
                            ) : (
                              <td className="py-2 sm:py-3 px-1 sm:px-2 text-right">
                                <span className="text-gray-400 dark:text-gray-500 text-sm sm:text-sm">-</span>
                              </td>
                            )}
                          </>
                        )}
                        {/* Comparison column only in year view */}
                        {currentYear && previousYear && !isHiddenExpense && (
                          <td className="py-2 sm:py-3 px-1 sm:px-2 text-right">
                            {item.difference !== null ? (
                              formatDifference(item.difference, item.isIncome || item.isBalance)
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500 text-sm sm:text-sm">-</span>
                            )}
                          </td>
                        )}
                        {currentYear && previousYear && isHiddenExpense && (
                          <td className="py-2 sm:py-3 px-1 sm:px-2 text-right">
                            <span className="text-gray-400 dark:text-gray-500 text-sm sm:text-sm">-</span>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Categories Table - Only show in year view */}
          {currentYear && categoriesData.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 sm:mb-4">Category Breakdown (€)</h3>
              <div className="overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 sm:py-3 px-1 sm:px-2 font-medium text-gray-600 dark:text-gray-400 text-sm sm:text-sm"></th>
                      <th className="text-right py-2 sm:py-3 px-1 sm:px-2 font-medium text-gray-600 dark:text-gray-400 text-sm sm:text-sm">
                        {currentYear ? 'Monthly' : 'Total'}
                      </th>
                      {currentYear && previousYear && (
                        <th className="text-right py-2 sm:py-3 px-1 sm:px-2 font-medium text-gray-600 dark:text-gray-400 text-sm sm:text-sm">
                          vs {previousYear}
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {categoriesData.map((item) => (
                      <tr key={`${item.type}-${item.category}`} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                        <td className="py-2 sm:py-3 px-1 sm:px-2">
                          <div className="flex items-center min-w-0">
                            <item.icon {...({ size: 14, className: "text-gray-400 dark:text-gray-500 mr-1 sm:mr-3 flex-shrink-0 sm:w-5 sm:h-5" } as LucideProps)} />
                            <div className={`relative min-w-0 flex-1 ${currentYear && previousYear ? 'max-w-[140px] sm:max-w-[200px]' : ''}`}>
                              <span 
                                className={`font-medium text-sm sm:text-sm block ${currentYear && previousYear ? 'overflow-hidden whitespace-nowrap' : ''} ${
                                  item.type === 'income'
                                    ? 'text-green-600 dark:text-green-400'
                                    : 'text-red-600 dark:text-red-400'
                                }`} 
                                title={item.category}
                                style={currentYear && previousYear ? {
                                  maskImage: 'linear-gradient(to right, black 0%, black 85%, transparent 100%)',
                                  WebkitMaskImage: 'linear-gradient(to right, black 0%, black 85%, transparent 100%)'
                                } : undefined}
                              >
                                {item.category}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 px-1 sm:px-2 text-right">
                          <span className={`text-sm sm:text-sm ${
                            item.type === 'income' ? 'text-green-500' : 'text-red-500'
                          }`}>
                            {formatAmount(Math.abs(currentYear ? item.monthlyAverage : item.total))}
                          </span>
                        </td>
                        {currentYear && previousYear && (
                          <td className="py-2 sm:py-3 px-1 sm:px-2 text-right">
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

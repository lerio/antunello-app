import React, { useState } from "react";
import { Transaction } from "@/types/database";
import { formatCurrency } from "@/utils/currency";
import { CATEGORY_ICONS } from "@/utils/categories";
import { LucideProps, ChevronDown, ChevronRight } from "lucide-react";
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
  readonly transactions: Transaction[];
  readonly isLoading?: boolean;
  readonly includeHiddenInTotals?: boolean;
  readonly currentYear?: number;
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
  for (const transaction of transactions) {
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
  }

  // Calculate previous year totals if data is available
  if (previousYearTransactions && previousYearTransactions.length > 0) {
    for (const transaction of previousYearTransactions) {
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
    }
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

  // Helper function to determine color class based on difference and type
  const getDifferenceColorClass = (difference: number, isIncome: boolean = false): string => {
    const isPositive = difference > 0;
    if (isIncome) {
      return isPositive ? 'text-green-500' : 'text-red-500';
    }
    return isPositive ? 'text-red-500' : 'text-green-500';
  };

  // Helper function to format difference with color
  const formatDifference = (difference: number, isIncome: boolean = false) => {
    const isPositive = difference > 0;
    const sign = isPositive ? '+' : '-';
    const colorClass = getDifferenceColorClass(difference, isIncome);

    return (
      <span className={`${colorClass} text-sm sm:text-sm`}>
        {sign}{formatAmount(Math.abs(difference))}
      </span>
    );
  };

  // Helper to get category name class
  const getCategoryNameClass = (isSubCategory: boolean, isHiddenExpense: boolean, isBalance: boolean, isIncome: boolean, total?: number): string => {
    const baseClass = 'text-sm sm:text-sm';

    if (isSubCategory) {
      return `${baseClass} ml-4`;
    }
    if (isHiddenExpense) {
      return `${baseClass} text-red-600 dark:text-red-400 ml-2 sm:ml-4`;
    }
    if (isBalance) {
      const colorClass = (total || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
      return `font-medium ${baseClass} ${colorClass}`;
    }
    if (isIncome) {
      return `font-medium ${baseClass} text-green-600 dark:text-green-400`;
    }
    return `font-medium ${baseClass} text-red-600 dark:text-red-400`;
  };

  // Helper to get total amount class
  const getTotalAmountClass = (isSubCategory: boolean, itemType: string, isHiddenExpense: boolean, isBalance: boolean, total?: number): string => {
    const baseClass = 'text-sm sm:text-sm';

    if (isSubCategory) {
      return `${baseClass} ${itemType === 'income' ? 'text-green-500' : 'text-red-500'}`;
    }
    if (isHiddenExpense) {
      return `${baseClass} text-red-500`;
    }
    if (isBalance) {
      return `font-medium ${baseClass} ${(total || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`;
    }
    return `font-medium ${baseClass} text-${itemType === 'income' ? 'green' : 'red'}-500`;
  };

  // Helper to get monthly amount class
  const getMonthlyAmountClass = (isBalance: boolean, monthlyAverage?: number): string => {
    const baseClass = 'text-sm sm:text-sm';

    if (isBalance) {
      return `${baseClass} ${(monthlyAverage || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`;
    }
    return baseClass;
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

  // Helper to get difference if years available
  const getDifferenceIfAvailable = (current: number, previous: number, isBalance: boolean = false) => {
    return currentYear && previousYear ? getDifferenceFromPrevYear(current, previous, isBalance) : null;
  };

  // Helper to create base totals data row
  const createBaseData = () => [
    {
      category: balanceTotal >= 0 ? 'Gains' : 'Losses',
      total: balanceTotal,
      monthlyAverage: getMonthlyAverage(balanceTotal, currentYear),
      difference: getDifferenceIfAvailable(balanceTotal, prevYearBalanceTotal, true),
      isBalance: true
    },
    {
      category: 'Income',
      total: incomeTotal,
      monthlyAverage: getMonthlyAverage(incomeTotal, currentYear),
      difference: getDifferenceIfAvailable(incomeTotal, prevYearIncomeTotal),
      isIncome: true,
      isCollapsible: !currentYear
    },
    {
      category: 'Expenses',
      total: expenseTotal,
      monthlyAverage: getMonthlyAverage(expenseTotal, currentYear),
      difference: getDifferenceIfAvailable(expenseTotal, prevYearExpenseTotal),
      isExpense: true,
      isCollapsible: !currentYear
    },
    ...(hiddenExpenseTotal > 0 ? [{
      category: 'Hidden',
      total: hiddenExpenseTotal,
      monthlyAverage: getMonthlyAverage(hiddenExpenseTotal, currentYear),
      difference: getDifferenceIfAvailable(hiddenExpenseTotal, prevYearHiddenExpenseTotal),
      isHiddenExpense: true
    }] : [])
  ];

  // Helper to add income categories to extended data
  const addIncomeCategoryRows = (extendedData: any[]) => {
    if (!isIncomeExpanded) return;
    for (const [category, amount] of Object.entries(incomeCategoryTotals).sort(([, a], [, b]) => b - a)) {
        extendedData.push({
          category,
          total: amount,
          monthlyAverage: getMonthlyAverage(amount, currentYear),
          difference: null,
          isSubCategory: true,
          type: 'income',
          icon: CATEGORY_ICONS[category]
        });
    }
  };

  // Helper to add expense categories to extended data
  const addExpenseCategoryRows = (extendedData: any[]) => {
    if (!isExpensesExpanded) return;
    for (const [category, amount] of Object.entries(expenseCategoryTotals).sort(([, a], [, b]) => b - a)) {
        extendedData.push({
          category,
          total: amount,
          monthlyAverage: getMonthlyAverage(amount, currentYear),
          difference: null,
          isSubCategory: true,
          type: 'expense',
          icon: CATEGORY_ICONS[category]
        });
    }
  };

  // Prepare totals data with categories for monthly view
  const createTotalsData = () => {
    const baseData = createBaseData();

    // In monthly view, add category breakdowns under Income and Expenses
    if (!currentYear) {
      const extendedData: any[] = [];

      for (const item of baseData) {
        extendedData.push(item);

        // Add income categories after Income row
        if (item.isIncome) {
          addIncomeCategoryRows(extendedData);
        }

        // Add expense categories after Expenses row
        if (item.isExpense) {
          addExpenseCategoryRows(extendedData);
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
    const entries = Object.entries(incomeCategoryTotals).sort(([, a], [, b]) => b - a);
    for (const [category, amount] of entries) {
      const prevYearAmount = prevYearIncomeCategoryTotals[category] || 0;
      categoriesData.push({
        type: 'income',
        category,
        icon: CATEGORY_ICONS[category],
        total: amount,
        monthlyAverage: getMonthlyAverage(amount, currentYear),
        difference: currentYear != null && previousYear != null ? getDifferenceFromPrevYear(amount, prevYearAmount) : null
      });
    }
  }
  
  // Add Expense categories
  if (Object.keys(expenseCategoryTotals).length > 0) {
    const entries = Object.entries(expenseCategoryTotals).sort(([, a], [, b]) => b - a);
    for (const [category, amount] of entries) {
      const prevYearAmount = prevYearExpenseCategoryTotals[category] || 0;
      categoriesData.push({
        type: 'expense',
        category,
        icon: CATEGORY_ICONS[category],
        total: amount,
        monthlyAverage: getMonthlyAverage(amount, currentYear),
        difference: currentYear != null && previousYear != null ? getDifferenceFromPrevYear(amount, prevYearAmount) : null
      });
    }
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
                {currentYear != null && (
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 sm:py-3 px-1 sm:px-2 font-medium text-gray-600 dark:text-gray-400 text-sm sm:text-sm"></th>
                      <th className="text-right py-2 sm:py-3 px-1 sm:px-2 font-medium text-gray-600 dark:text-gray-400 text-sm sm:text-sm">Total</th>
                      <th className="text-right py-2 sm:py-3 px-1 sm:px-2 font-medium text-gray-600 dark:text-gray-400 text-sm sm:text-sm">Monthly</th>
                      {previousYear != null && (
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

                    let isExpanded = false;
                    if (item.isIncome) {
                      isExpanded = isIncomeExpanded;
                    } else if (item.isExpense) {
                      isExpanded = isExpensesExpanded;
                    }

                    const handleToggleExpand = () => {
                      if (item.isIncome) {
                        setIsIncomeExpanded(!isIncomeExpanded);
                      } else if (item.isExpense) {
                        setIsExpensesExpanded(!isExpensesExpanded);
                      }
                    };

                    return (
                      <tr key={`${item.category}`} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                        <td className="py-2 sm:py-3 px-1 sm:px-2">
                          <div className="flex items-center">
                            {isCollapsible && (
                              <button
                                onClick={handleToggleExpand}
                                className="mr-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                              >
                                {isExpanded ? (
                                  <ChevronDown size={16} className="text-gray-600 dark:text-gray-400" />
                                ) : (
                                  <ChevronRight size={16} className="text-gray-600 dark:text-gray-400" />
                                )}
                              </button>
                            )}
                            {isSubCategory && item.icon && (
                              <item.icon size={16} className="text-gray-400 dark:text-gray-500 mr-2" />
                            )}
                            <span className={getCategoryNameClass(isSubCategory, isHiddenExpense, item.isBalance || false, item.isIncome || false, item.total)}>
                              {item.category}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 px-1 sm:px-2 text-right">
                          <span className={getTotalAmountClass(isSubCategory, item.type || '', isHiddenExpense, item.isBalance || false, item.total)}>
                            {formatAmount(Math.abs(item.total))}
                          </span>
                        </td>
                        {/* Monthly column only in year view */}
                        {currentYear != null && (
                          <td className="py-2 sm:py-3 px-1 sm:px-2 text-right">
                            {isHiddenExpense ? (
                              <span className="text-gray-400 dark:text-gray-500 text-sm sm:text-sm">-</span>
                            ) : (
                              <span className={getMonthlyAmountClass(item.isBalance || false, item.monthlyAverage)}>
                                {formatAmount(Math.abs(item.monthlyAverage))}
                              </span>
                            )}
                          </td>
                        )}
                        {/* Comparison column only in year view */}
                        {currentYear != null && previousYear != null && (
                          <td className="py-2 sm:py-3 px-1 sm:px-2 text-right">
                            {isHiddenExpense ? (
                              <span className="text-gray-400 dark:text-gray-500 text-sm sm:text-sm">-</span>
                            ) : item.difference === null ? (
                              <span className="text-gray-400 dark:text-gray-500 text-sm sm:text-sm">-</span>
                            ) : (
                              formatDifference(item.difference, item.isIncome || item.isBalance)
                            )}
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
          {currentYear != null && categoriesData.length > 0 && (
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
                      {currentYear != null && previousYear != null && (
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
                            <div className={`relative min-w-0 flex-1 ${currentYear != null && previousYear != null ? 'max-w-[140px] sm:max-w-[200px]' : ''}`}>
                              <span 
                                className={`font-medium text-sm sm:text-sm block ${currentYear != null && previousYear != null ? 'overflow-hidden whitespace-nowrap' : ''} ${
                                  item.type === 'income'
                                    ? 'text-green-600 dark:text-green-400'
                                    : 'text-red-600 dark:text-red-400'
                                }`} 
                                title={item.category}
                                style={currentYear != null && previousYear != null ? {
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
                        {currentYear != null && previousYear != null && (
                          <td className="py-2 sm:py-3 px-1 sm:px-2 text-right">
                            {item.difference === null ? (
                              <span className="text-gray-400 dark:text-gray-500">-</span>
                            ) : (
                              formatDifference(item.difference, item.type === 'income')
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

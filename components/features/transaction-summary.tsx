import React, { useState } from "react";
import { Transaction } from "@/types/database";
import { CATEGORY_ICONS } from "@/utils/categories";
import { LucideProps, ChevronDown, ChevronRight } from "lucide-react";
import { useYearTransactions } from "@/hooks/useYearTransactions";

type CurrencyTotals = { [currency: string]: number };

type CategoryTotals = { [category: string]: { [currency: string]: number } };

type CategoryData = {
  type: 'income' | 'expense';
  category: string;
  icon: React.ComponentType<LucideProps>;
  total: number;
  monthlyAverage: number;
  difference: number | null;
};

type SummaryTotals = {
  expenseTotal: number;
  incomeTotal: number;
  incomeCategoryTotals: Record<string, number>;
  expenseCategoryTotals: Record<string, number>;
  hiddenExpenseTotal: number;
};

type PrevYearTotals = {
  prevYearExpenseTotal: number;
  prevYearIncomeTotal: number;
  prevYearIncomeCategoryTotals: Record<string, number>;
  prevYearExpenseCategoryTotals: Record<string, number>;
  prevYearHiddenExpenseTotal: number;
};

type TotalsItem = {
  category: string;
  total: number;
  monthlyAverage?: number;
  difference: number | null;
  isBalance?: boolean;
  isIncome?: boolean;
  isExpense?: boolean;
  isHiddenExpense?: boolean;
  isCollapsible?: boolean;
  isSubCategory?: boolean;
  type?: 'income' | 'expense';
  icon?: React.ComponentType<LucideProps>;
};

function getMonthlyAverage(total: number, year?: number) {
  if (year && year === new Date().getFullYear()) {
    const currentMonth = new Date().getMonth();
    const completedMonths = currentMonth;
    return completedMonths > 0 ? total / completedMonths : total;
  }
  return total / 12;
}

function getDifferenceFromPrevYear(currentTotal: number, prevYearTotal: number): number {
  const currentMonthlyAvg = getMonthlyAverage(currentTotal);
  const prevYearMonthlyAvg = getMonthlyAverage(prevYearTotal);
  return currentMonthlyAvg - prevYearMonthlyAvg;
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

function getDifferenceColorClass(difference: number, isIncome: boolean = false): string {
  const isPositive = difference > 0;
  if (isIncome) return isPositive ? 'text-green-500' : 'text-red-500';
  return isPositive ? 'text-red-500' : 'text-green-500';
}

function formatDifference(difference: number, isIncome: boolean = false) {
  const sign = difference > 0 ? '+' : '-';
  const colorClass = getDifferenceColorClass(difference, isIncome);
  return (
    <span className={`${colorClass} text-sm sm:text-sm`}>
      {sign}{formatAmount(Math.abs(difference))}
    </span>
  );
}

function getCategoryNameClass(isSubCategory: boolean, isHiddenExpense: boolean, isBalance: boolean, isIncome: boolean, total?: number): string {
  const baseClass = 'text-sm sm:text-sm';
  if (isSubCategory) return `${baseClass} ml-4`;
  if (isHiddenExpense) return `${baseClass} text-red-600 dark:text-red-400 ml-2 sm:ml-4`;
  if (isBalance) {
    const colorClass = (total || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
    return `font-medium ${baseClass} ${colorClass}`;
  }
  if (isIncome) return `font-medium ${baseClass} text-green-600 dark:text-green-400`;
  return `font-medium ${baseClass} text-red-600 dark:text-red-400`;
}

function getTotalAmountClass(isSubCategory: boolean, itemType: string, isHiddenExpense: boolean, isBalance: boolean, total?: number): string {
  const baseClass = 'text-sm sm:text-sm';
  if (isSubCategory) return `${baseClass} ${itemType === 'income' ? 'text-green-500' : 'text-red-500'}`;
  if (isHiddenExpense) return `${baseClass} text-red-500`;
  if (isBalance) return `font-medium ${baseClass} ${(total || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`;
  return `font-medium ${baseClass} text-${itemType === 'income' ? 'green' : 'red'}-500`;
}

function getMonthlyAmountClass(isBalance: boolean, monthlyAverage?: number): string {
  const baseClass = 'text-sm sm:text-sm';
  if (isBalance) return `${baseClass} ${(monthlyAverage || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`;
  return baseClass;
}

function inc(map: Record<string, number>, key: string, amount: number) {
  map[key] = (map[key] || 0) + amount;
}

function computeYearTotals(transactions: ReadonlyArray<Transaction>): SummaryTotals {
  let expenseTotal = 0;
  let incomeTotal = 0;
  const incomeCategoryTotals: Record<string, number> = {};
  const expenseCategoryTotals: Record<string, number> = {};
  let hiddenExpenseTotal = 0;

  const converted = transactions.filter((t) => t.eur_amount !== null && t.eur_amount !== undefined);
  const hidden = converted.filter((t) => t.hide_from_totals);
  const visible = converted.filter((t) => !t.hide_from_totals);

  for (const t of hidden) {
    if (t.type === "expense") hiddenExpenseTotal += t.eur_amount as number;
  }

  for (const t of visible) {
    const eur = t.eur_amount as number;
    if (t.type === "expense") {
      expenseTotal += eur;
      inc(expenseCategoryTotals, t.main_category, eur);
    } else {
      incomeTotal += eur;
      inc(incomeCategoryTotals, t.main_category, eur);
    }
  }

  return { expenseTotal, incomeTotal, incomeCategoryTotals, expenseCategoryTotals, hiddenExpenseTotal };
}

function computePrevYearTotals(transactions?: ReadonlyArray<Transaction>): PrevYearTotals {
  let prevYearExpenseTotal = 0;
  let prevYearIncomeTotal = 0;
  const prevYearIncomeCategoryTotals: Record<string, number> = {};
  const prevYearExpenseCategoryTotals: Record<string, number> = {};
  let prevYearHiddenExpenseTotal = 0;

  const list = transactions ?? [];
  const converted = list.filter((t) => t.eur_amount !== null && t.eur_amount !== undefined);
  const hidden = converted.filter((t) => t.hide_from_totals);
  const visible = converted.filter((t) => !t.hide_from_totals);

  for (const t of hidden) {
    if (t.type === "expense") prevYearHiddenExpenseTotal += t.eur_amount as number;
  }

  for (const t of visible) {
    const eur = t.eur_amount as number;
    if (t.type === "expense") {
      prevYearExpenseTotal += eur;
      inc(prevYearExpenseCategoryTotals, t.main_category, eur);
    } else {
      prevYearIncomeTotal += eur;
      inc(prevYearIncomeCategoryTotals, t.main_category, eur);
    }
  }

  return { prevYearExpenseTotal, prevYearIncomeTotal, prevYearIncomeCategoryTotals, prevYearExpenseCategoryTotals, prevYearHiddenExpenseTotal };
}

function getDifferenceIfAvailable(current: number, previous: number, currentYear?: number, previousYear?: number, isBalance: boolean = false) {
  return currentYear && previousYear ? getDifferenceFromPrevYear(current, previous) : null;
}

function buildCategoriesData(
  incomeCategoryTotals: Record<string, number>,
  expenseCategoryTotals: Record<string, number>,
  prevYearIncomeCategoryTotals: Record<string, number>,
  prevYearExpenseCategoryTotals: Record<string, number>,
  currentYear?: number,
  previousYear?: number
): CategoryData[] {
  const categoriesData: CategoryData[] = [];

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
        difference: currentYear !== undefined && previousYear !== undefined ? getDifferenceFromPrevYear(amount, prevYearAmount) : null
      });
    }
  }

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
        difference: currentYear !== undefined && previousYear !== undefined ? getDifferenceFromPrevYear(amount, prevYearAmount) : null
      });
    }
  }

  return categoriesData;
}

type BaseDataContext = {
  readonly balanceTotal: number;
  readonly incomeTotal: number;
  readonly expenseTotal: number;
  readonly hiddenExpenseTotal: number;
  readonly prevYearBalanceTotal: number;
  readonly prevYearIncomeTotal: number;
  readonly prevYearExpenseTotal: number;
  readonly prevYearHiddenExpenseTotal: number;
  readonly currentYear?: number;
  readonly previousYear?: number;
};

function createBaseData(ctx: BaseDataContext): TotalsItem[] {
  const {
    balanceTotal,
    incomeTotal,
    expenseTotal,
    hiddenExpenseTotal,
    prevYearBalanceTotal,
    prevYearIncomeTotal,
    prevYearExpenseTotal,
    prevYearHiddenExpenseTotal,
    currentYear,
    previousYear,
  } = ctx;

  const base: TotalsItem[] = [
    {
      category: balanceTotal >= 0 ? 'Gains' : 'Losses',
      total: balanceTotal,
      monthlyAverage: getMonthlyAverage(balanceTotal, currentYear),
      difference: getDifferenceIfAvailable(balanceTotal, prevYearBalanceTotal, currentYear, previousYear, true),
      isBalance: true
    },
    {
      category: 'Income',
      total: incomeTotal,
      monthlyAverage: getMonthlyAverage(incomeTotal, currentYear),
      difference: getDifferenceIfAvailable(incomeTotal, prevYearIncomeTotal, currentYear, previousYear),
      isIncome: true,
      isCollapsible: !currentYear
    },
    {
      category: 'Expenses',
      total: expenseTotal,
      monthlyAverage: getMonthlyAverage(expenseTotal, currentYear),
      difference: getDifferenceIfAvailable(expenseTotal, prevYearExpenseTotal, currentYear, previousYear),
      isExpense: true,
      isCollapsible: !currentYear
    }
  ];

  if (hiddenExpenseTotal > 0) {
    base.push({
      category: 'Hidden',
      total: hiddenExpenseTotal,
      monthlyAverage: getMonthlyAverage(hiddenExpenseTotal, currentYear),
      difference: getDifferenceIfAvailable(hiddenExpenseTotal, prevYearHiddenExpenseTotal, currentYear, previousYear),
      isHiddenExpense: true
    });
  }

  return base;
}

function extendWithCategoryRows(
  baseData: TotalsItem[],
  isIncomeExpanded: boolean,
  isExpensesExpanded: boolean,
  incomeCategoryTotals: Record<string, number>,
  expenseCategoryTotals: Record<string, number>,
  currentYear?: number
): TotalsItem[] {
  const extended: TotalsItem[] = [];

  for (const item of baseData) {
    extended.push(item);

    if (item.isIncome && isIncomeExpanded) {
      for (const [category, amount] of Object.entries(incomeCategoryTotals).sort(([, a], [, b]) => b - a)) {
        extended.push({
          category,
          total: amount,
          monthlyAverage: getMonthlyAverage(amount, currentYear),
          difference: null,
          isSubCategory: true,
          type: 'income',
          icon: CATEGORY_ICONS[category]
        });
      }
    }

    if (item.isExpense && isExpensesExpanded) {
      for (const [category, amount] of Object.entries(expenseCategoryTotals).sort(([, a], [, b]) => b - a)) {
        extended.push({
          category,
          total: amount,
          monthlyAverage: getMonthlyAverage(amount, currentYear),
          difference: null,
          isSubCategory: true,
          type: 'expense',
          icon: CATEGORY_ICONS[category]
        });
      }
    }
  }

  return extended;
}

function renderComparisonCell(item: TotalsItem): React.ReactNode {
  if (item.isHiddenExpense) return <span className="text-gray-400 dark:text-gray-500 text-sm sm:text-sm">-</span>;
  if (item.difference === null) return <span className="text-gray-400 dark:text-gray-500 text-sm sm:text-sm">-</span>;
  return formatDifference(item.difference, !!(item.isIncome || item.isBalance));
}

type TotalsTableProps = {
  readonly totalsData: TotalsItem[];
  readonly currentYear?: number;
  readonly previousYear?: number;
  readonly isIncomeExpanded: boolean;
  readonly isExpensesExpanded: boolean;
  readonly onToggleIncome: () => void;
  readonly onToggleExpenses: () => void;
  readonly isDetailsExpanded: boolean;
  readonly onToggleDetails: () => void;
};

function TotalsTable({
  totalsData,
  currentYear,
  previousYear,
  isIncomeExpanded,
  isExpensesExpanded,
  onToggleIncome,
  onToggleExpenses,
  isDetailsExpanded,
  onToggleDetails,
}: TotalsTableProps) {
  // Find the balance item to determine if it's gains or losses
  const balanceItem = totalsData.find(item => item.isBalance);
  const balanceTotal = balanceItem?.total || 0;
  const isGains = balanceTotal >= 0;
  const title = isGains ? `Gains (€${formatAmount(Math.abs(balanceTotal))})` : `Losses (€${formatAmount(Math.abs(balanceTotal))})`;

  // Filter data - when collapsed, show nothing (title shows the balance); when expanded, show all except balance
  const filteredData = isDetailsExpanded ? totalsData.filter(item => !item.isBalance) : [];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h3 className={`text-base sm:text-lg font-semibold ${isGains ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{title}</h3>
        <button
          onClick={onToggleDetails}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          aria-label={isDetailsExpanded ? 'Collapse details' : 'Expand details'}
        >
          {isDetailsExpanded ? (
            <ChevronDown size={18} className="text-gray-600 dark:text-gray-400" />
          ) : (
            <ChevronRight size={18} className="text-gray-600 dark:text-gray-400" />
          )}
        </button>
      </div>
      <div className="overflow-hidden">
        <table className="w-full">
          {currentYear !== undefined && (
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 sm:py-3 px-1 sm:px-2 font-medium text-gray-600 dark:text-gray-400 text-sm sm:text-sm"></th>
                <th className="text-right py-2 sm:py-3 px-1 sm:px-2 font-medium text-gray-600 dark:text-gray-400 text-sm sm:text-sm">Total</th>
                <th className="text-right py-2 sm:py-3 px-1 sm:px-2 font-medium text-gray-600 dark:text-gray-400 text-sm sm:text-sm">Monthly</th>
                {previousYear !== undefined && (
                  <th className="text-right py-2 sm:py-3 px-1 sm:px-2 font-medium text-gray-600 dark:text-gray-400 text-sm sm:text-sm">vs {previousYear}</th>
                )}
              </tr>
            </thead>
          )}
          <tbody>
            {filteredData.map((item) => {
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
                if (item.isIncome) onToggleIncome();
                else if (item.isExpense) onToggleExpenses();
              };

              return (
                <tr key={`${item.category}`} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                  <td className="py-2 sm:py-3 px-1 sm:px-2">
                    <div className="flex items-center">
                      {isCollapsible && (
                        <button onClick={handleToggleExpand} className="mr-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
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
                      <span className={getCategoryNameClass(!!isSubCategory, !!isHiddenExpense, item.isBalance || false, item.isIncome || false, item.total)}>
                        {item.category}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 sm:py-3 px-1 sm:px-2 text-right">
                    <span className={getTotalAmountClass(!!isSubCategory, item.type || '', !!isHiddenExpense, item.isBalance || false, item.total)}>
                      {formatAmount(Math.abs(item.total))}
                    </span>
                  </td>
                  {currentYear !== undefined && (
                    <td className="py-2 sm:py-3 px-1 sm:px-2 text-right">
                      {isHiddenExpense ? (
                        <span className="text-gray-400 dark:text-gray-500 text-sm sm:text-sm">-</span>
                      ) : (
                        <span className={getMonthlyAmountClass(item.isBalance || false, item.monthlyAverage)}>
                          {formatAmount(Math.abs(item.monthlyAverage || 0))}
                        </span>
                      )}
                    </td>
                  )}
                  {currentYear !== undefined && previousYear !== undefined && (
                    <td className="py-2 sm:py-3 px-1 sm:px-2 text-right">{renderComparisonCell(item)}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type CategoriesTableProps = {
  readonly categoriesData: CategoryData[];
  readonly currentYear?: number;
  readonly previousYear?: number;
};

function CategoriesTable({ categoriesData, currentYear, previousYear }: CategoriesTableProps) {
  if (currentYear === undefined || categoriesData.length === 0) return null;
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 sm:p-6">
      <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 sm:mb-4">Category Breakdown (€)</h3>
      <div className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 sm:py-3 px-1 sm:px-2 font-medium text-gray-600 dark:text-gray-400 text-sm sm:text-sm"></th>
              <th className="text-right py-2 sm:py-3 px-1 sm:px-2 font-medium text-gray-600 dark:text-gray-400 text-sm sm:text-sm">{currentYear ? 'Monthly' : 'Total'}</th>
              {currentYear !== undefined && previousYear !== undefined && (
                <th className="text-right py-2 sm:py-3 px-1 sm:px-2 font-medium text-gray-600 dark:text-gray-400 text-sm sm:text-sm">vs {previousYear}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {categoriesData.map((item) => (
              <tr key={`${item.type}-${item.category}`} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                <td className="py-2 sm:py-3 px-1 sm:px-2">
                  <div className="flex items-center min-w-0">
                    <item.icon size={14} className="text-gray-400 dark:text-gray-500 mr-1 sm:mr-3 flex-shrink-0 sm:w-5 sm:h-5" />
                    <div className={`relative min-w-0 flex-1 ${currentYear !== undefined && previousYear !== undefined ? 'max-w-[140px] sm:max-w-[200px]' : ''}`}>
                      <span
                        className={`font-medium text-sm sm:text-sm block ${currentYear !== undefined && previousYear !== undefined ? 'overflow-hidden whitespace-nowrap' : ''} ${
                          item.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}
                        title={item.category}
                        style={currentYear !== undefined && previousYear !== undefined ? {
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
                  <span className={`text-sm sm:text-sm ${item.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                    {formatAmount(Math.abs(currentYear ? item.monthlyAverage : item.total))}
                  </span>
                </td>
                {currentYear !== undefined && previousYear !== undefined && (
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
  );
}
type TransactionSummaryProps = {
  readonly transactions: Transaction[];
  readonly isLoading?: boolean;
  readonly includeHiddenInTotals?: boolean;
  readonly currentYear?: number;
};

function LoadingSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-8">
      <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded animate-pulse w-20"></div>
        <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded animate-pulse w-24"></div>
      </div>
      <div className="mt-4 space-y-4">
        {["ls-1", "ls-2", "ls-3"].map((id) => (
          <div key={id} className="flex justify-between items-center">
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
}

export default function TransactionSummary({
  transactions,
  isLoading = false,
  includeHiddenInTotals = false,
  currentYear,
}: TransactionSummaryProps) {

  // State for collapsible categories in monthly view
  const [isIncomeExpanded, setIsIncomeExpanded] = useState(false);
  const [isExpensesExpanded, setIsExpensesExpanded] = useState(false);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

  // Fetch previous year data for comparison if currentYear is provided
  const previousYear = currentYear ? currentYear - 1 : undefined;
  const { transactions: previousYearTransactions } = useYearTransactions(previousYear);

  // Compute current and previous year totals via helpers
  const {
    expenseTotal,
    incomeTotal,
    incomeCategoryTotals,
    expenseCategoryTotals,
    hiddenExpenseTotal,
  } = computeYearTotals(transactions);

  const {
    prevYearExpenseTotal,
    prevYearIncomeTotal,
    prevYearIncomeCategoryTotals,
    prevYearExpenseCategoryTotals,
    prevYearHiddenExpenseTotal
  } = computePrevYearTotals(previousYearTransactions);

  // Calculate balance
  const balanceTotal = incomeTotal - expenseTotal;
  const prevYearBalanceTotal = prevYearIncomeTotal - prevYearExpenseTotal;

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Prepare totals data with categories for monthly view
  const baseData = createBaseData({
    balanceTotal,
    incomeTotal,
    expenseTotal,
    hiddenExpenseTotal,
    prevYearBalanceTotal,
    prevYearIncomeTotal,
    prevYearExpenseTotal,
    prevYearHiddenExpenseTotal,
    currentYear,
    previousYear,
  });

  const totalsData = currentYear
    ? baseData
    : extendWithCategoryRows(
        baseData,
        isIncomeExpanded,
        isExpensesExpanded,
        incomeCategoryTotals,
        expenseCategoryTotals,
        currentYear
      );

  // Prepare categories data
  const categoriesData: CategoryData[] = buildCategoriesData(
    incomeCategoryTotals,
    expenseCategoryTotals,
    prevYearIncomeCategoryTotals,
    prevYearExpenseCategoryTotals,
    currentYear,
    previousYear
  );

  const hasData = Object.keys(incomeCategoryTotals).length > 0 || Object.keys(expenseCategoryTotals).length > 0;

  return (
    <div className="space-y-4 sm:space-y-6 mb-6 sm:mb-8">
      {hasData ? (
        <>
          
          <TotalsTable
            totalsData={totalsData}
            currentYear={currentYear}
            previousYear={previousYear}
            isIncomeExpanded={isIncomeExpanded}
            isExpensesExpanded={isExpensesExpanded}
            onToggleIncome={() => setIsIncomeExpanded(!isIncomeExpanded)}
            onToggleExpenses={() => setIsExpensesExpanded(!isExpensesExpanded)}
            isDetailsExpanded={isDetailsExpanded}
            onToggleDetails={() => setIsDetailsExpanded(!isDetailsExpanded)}
          />

          <CategoriesTable categoriesData={categoriesData} currentYear={currentYear} previousYear={previousYear} />
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

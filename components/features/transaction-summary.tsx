import React, { useState, useMemo, useCallback } from "react";
import { Transaction } from "@/types/database";
import { CATEGORY_ICONS } from "@/utils/categories";
import { LucideProps, ChevronDown, ChevronUp, GitFork } from "lucide-react";
import { useYearTransactions } from "@/hooks/useYearTransactions";
import { SummarySkeleton } from "@/components/ui/skeletons";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { PrivacyBlur } from "@/components/ui/privacy-blur";
import {
  getTransactionDisplayEurAmount,
} from "@/utils/split-transactions";
import {
  getDifferenceColorClass,
  getCategoryNameClass,
  getTotalAmountClass,
  getMonthlyAmountClass,
} from "@/utils/styling-utils";
import { formatCurrency } from "@/utils/currency";

type CategoryData = {
  type: "income" | "expense";
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
  type?: "income" | "expense";
  icon?: React.ComponentType<LucideProps>;
};

function getMonthlyAverage(total: number, numberOfMonths: number = 12) {
  return numberOfMonths > 0 ? total / numberOfMonths : total;
}

function getDifferenceFromPrevYear(
  currentTotal: number,
  prevYearTotal: number,
  numberOfMonths: number = 12,
): number {
  const currentMonthlyAvg = getMonthlyAverage(currentTotal, numberOfMonths);
  const prevYearMonthlyAvg = getMonthlyAverage(prevYearTotal, numberOfMonths);
  return currentMonthlyAvg - prevYearMonthlyAvg;
}

function formatMonthRange(lastCompleteMonth: number): string {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `Jan–${months[lastCompleteMonth]}`;
}

function filterTransactionsToLastCompleteMonth(
  transactions: ReadonlyArray<Transaction>,
  lastCompleteMonth: number,
): ReadonlyArray<Transaction> {
  if (lastCompleteMonth >= 11) return transactions; // Full year, no filtering needed
  if (lastCompleteMonth < 0) return []; // No complete months in the year yet
  return transactions.filter(
    (t) => new Date(t.date).getMonth() <= lastCompleteMonth,
  );
}

function formatAmount(amount: number) {
  return formatCurrency(amount, "EUR");
}

function formatDifference(
  difference: number,
  isIncome: boolean = false,
  privacyMode: boolean = false,
) {
  const sign = difference > 0 ? "+" : "-";
  const colorClass = getDifferenceColorClass(difference, isIncome);
  return (
    <span className={`${colorClass} text-sm sm:text-sm`}>
      <PrivacyBlur blur={privacyMode}>
        {sign}
        {formatAmount(Math.abs(difference))}
      </PrivacyBlur>
    </span>
  );
}

function inc(map: Record<string, number>, key: string, amount: number) {
  map[key] = (map[key] || 0) + amount;
}

function computeYearTotals(
  transactions: ReadonlyArray<Transaction>,
): SummaryTotals {
  let expenseTotal = 0;
  let incomeTotal = 0;
  const incomeCategoryTotals: Record<string, number> = {};
  const expenseCategoryTotals: Record<string, number> = {};
  let hiddenExpenseTotal = 0;

  const converted = transactions.filter(
    (t) =>
      getTransactionDisplayEurAmount(t) !== null &&
      getTransactionDisplayEurAmount(t) !== undefined,
  );
  for (const t of converted) {
    if (t.is_money_transfer) continue;

    if (t.hide_from_totals) {
      if (t.type === "expense") {
        hiddenExpenseTotal += getTransactionDisplayEurAmount(t) as number;
      }
      continue;
    }

    const eur = getTransactionDisplayEurAmount(t) as number;
    if (t.type === "expense") {
      expenseTotal += eur;
      inc(expenseCategoryTotals, t.main_category, eur);
    } else {
      incomeTotal += eur;
      inc(incomeCategoryTotals, t.main_category, eur);
    }
  }

  return {
    expenseTotal,
    incomeTotal,
    incomeCategoryTotals,
    expenseCategoryTotals,
    hiddenExpenseTotal,
  };
}

function computePrevYearTotals(
  transactions?: ReadonlyArray<Transaction>,
): PrevYearTotals {
  let prevYearExpenseTotal = 0;
  let prevYearIncomeTotal = 0;
  const prevYearIncomeCategoryTotals: Record<string, number> = {};
  const prevYearExpenseCategoryTotals: Record<string, number> = {};
  let prevYearHiddenExpenseTotal = 0;

  const list = transactions ?? [];
  const converted = list.filter(
    (t) =>
      getTransactionDisplayEurAmount(t) !== null &&
      getTransactionDisplayEurAmount(t) !== undefined,
  );
  for (const t of converted) {
    if (t.is_money_transfer) continue;

    if (t.hide_from_totals) {
      if (t.type === "expense") {
        prevYearHiddenExpenseTotal += getTransactionDisplayEurAmount(
          t,
        ) as number;
      }
      continue;
    }

    const eur = getTransactionDisplayEurAmount(t) as number;
    if (t.type === "expense") {
      prevYearExpenseTotal += eur;
      inc(prevYearExpenseCategoryTotals, t.main_category, eur);
    } else {
      prevYearIncomeTotal += eur;
      inc(prevYearIncomeCategoryTotals, t.main_category, eur);
    }
  }

  return {
    prevYearExpenseTotal,
    prevYearIncomeTotal,
    prevYearIncomeCategoryTotals,
    prevYearExpenseCategoryTotals,
    prevYearHiddenExpenseTotal,
  };
}

function getDifferenceIfAvailable(
  current: number,
  previous: number,
  currentYear?: number,
  previousYear?: number,
  numberOfMonths: number = 12,
) {
  return currentYear && previousYear
    ? getDifferenceFromPrevYear(current, previous, numberOfMonths)
    : null;
}

function buildCategoriesData(
  incomeCategoryTotals: Record<string, number>,
  expenseCategoryTotals: Record<string, number>,
  prevYearIncomeCategoryTotals: Record<string, number>,
  prevYearExpenseCategoryTotals: Record<string, number>,
  currentYear?: number,
  previousYear?: number,
  numberOfMonths: number = 12,
): CategoryData[] {
  const categoriesData: CategoryData[] = [];

  if (Object.keys(incomeCategoryTotals).length > 0) {
    const entries = Object.entries(incomeCategoryTotals).sort(
      ([, a], [, b]) => b - a,
    );
    for (const [category, amount] of entries) {
      const prevYearAmount = prevYearIncomeCategoryTotals[category] || 0;
      categoriesData.push({
        type: "income",
        category,
        icon: CATEGORY_ICONS[category],
        total: amount,
        monthlyAverage: getMonthlyAverage(amount, numberOfMonths),
        difference:
          currentYear !== undefined && previousYear !== undefined
            ? getDifferenceFromPrevYear(amount, prevYearAmount, numberOfMonths)
            : null,
      });
    }
  }

  if (Object.keys(expenseCategoryTotals).length > 0) {
    const entries = Object.entries(expenseCategoryTotals).sort(
      ([, a], [, b]) => b - a,
    );
    for (const [category, amount] of entries) {
      const prevYearAmount = prevYearExpenseCategoryTotals[category] || 0;
      categoriesData.push({
        type: "expense",
        category,
        icon: CATEGORY_ICONS[category],
        total: amount,
        monthlyAverage: getMonthlyAverage(amount, numberOfMonths),
        difference:
          currentYear !== undefined && previousYear !== undefined
            ? getDifferenceFromPrevYear(amount, prevYearAmount, numberOfMonths)
            : null,
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
  readonly numberOfMonths: number;
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
    numberOfMonths,
  } = ctx;

  const base: TotalsItem[] = [
    {
      category: "Net",
      total: balanceTotal,
      monthlyAverage: getMonthlyAverage(balanceTotal, numberOfMonths),
      difference: getDifferenceIfAvailable(
        balanceTotal,
        prevYearBalanceTotal,
        currentYear,
        previousYear,
        numberOfMonths,
      ),
      isBalance: true,
    },
    {
      category: "Income",
      total: incomeTotal,
      monthlyAverage: getMonthlyAverage(incomeTotal, numberOfMonths),
      difference: getDifferenceIfAvailable(
        incomeTotal,
        prevYearIncomeTotal,
        currentYear,
        previousYear,
        numberOfMonths,
      ),
      isIncome: true,
      isCollapsible: !currentYear,
    },
    {
      category: "Expenses",
      total: expenseTotal,
      monthlyAverage: getMonthlyAverage(expenseTotal, numberOfMonths),
      difference: getDifferenceIfAvailable(
        expenseTotal,
        prevYearExpenseTotal,
        currentYear,
        previousYear,
        numberOfMonths,
      ),
      isExpense: true,
      isCollapsible: !currentYear,
    },
  ];

  if (hiddenExpenseTotal > 0) {
    base.push({
      category: "Hidden",
      total: hiddenExpenseTotal,
      monthlyAverage: getMonthlyAverage(hiddenExpenseTotal, numberOfMonths),
      difference: getDifferenceIfAvailable(
        hiddenExpenseTotal,
        prevYearHiddenExpenseTotal,
        currentYear,
        previousYear,
        numberOfMonths,
      ),
      isHiddenExpense: true,
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
  numberOfMonths: number = 12,
): TotalsItem[] {
  const extended: TotalsItem[] = [];

  for (const item of baseData) {
    extended.push(item);

    if (item.isIncome && isIncomeExpanded) {
      for (const [category, amount] of Object.entries(
        incomeCategoryTotals,
      ).sort(([, a], [, b]) => b - a)) {
        extended.push({
          category,
          total: amount,
          monthlyAverage: getMonthlyAverage(amount, numberOfMonths),
          difference: null,
          isSubCategory: true,
          type: "income",
          icon: CATEGORY_ICONS[category],
        });
      }
    }

    if (item.isExpense && isExpensesExpanded) {
      for (const [category, amount] of Object.entries(
        expenseCategoryTotals,
      ).sort(([, a], [, b]) => b - a)) {
        extended.push({
          category,
          total: amount,
          monthlyAverage: getMonthlyAverage(amount, numberOfMonths),
          difference: null,
          isSubCategory: true,
          type: "expense",
          icon: CATEGORY_ICONS[category],
        });
      }
    }
  }

  return extended;
}

function renderComparisonCell(
  item: TotalsItem,
  privacyMode: boolean = false,
): React.ReactNode {
  if (item.isHiddenExpense)
    return <span className="text-muted-foreground text-sm sm:text-sm">-</span>;
  if (item.difference === null)
    return <span className="text-muted-foreground text-sm sm:text-sm">-</span>;
  return formatDifference(
    item.difference,
    !!(item.isIncome || item.isBalance),
    privacyMode,
  );
}

type TotalsTableProps = {
  readonly totalsData: TotalsItem[];
  readonly currentYear?: number;
  readonly previousYear?: number;
  readonly expectedSplitAmountEur?: number;
  readonly isIncomeExpanded: boolean;
  readonly isExpensesExpanded: boolean;
  readonly onToggleIncome: () => void;
  readonly onToggleExpenses: () => void;
  readonly isDetailsExpanded: boolean;
  readonly onToggleDetails: () => void;
  readonly privacyMode: boolean;
  readonly isCurrentYearView: boolean;
  readonly lastCompleteMonth: number;
  readonly isCurrentMonthView?: boolean;
  readonly periodLabel?: string;
};

function TotalsTable({
  totalsData,
  currentYear,
  previousYear,
  expectedSplitAmountEur = 0,
  isIncomeExpanded,
  isExpensesExpanded,
  onToggleIncome,
  onToggleExpenses,
  isDetailsExpanded,
  onToggleDetails,
  privacyMode,
  isCurrentYearView,
  lastCompleteMonth,
  isCurrentMonthView = false,
  periodLabel,
}: TotalsTableProps) {
  // The monthly summary is the redesigned card; the yearly one is deferred.
  const isMonthly = currentYear === undefined;
  // Find the balance item to determine if it's gains or losses
  const balanceItem = totalsData.find((item) => item.isBalance);
  const balanceTotal = balanceItem?.total || 0;
  const isGains = balanceTotal >= 0;
  const title = periodLabel ?? "Net";
  const signedBalance = `${balanceTotal < 0 ? "−" : balanceTotal > 0 ? "+" : ""}${formatAmount(
    Math.abs(balanceTotal),
  )}`;
  const balanceClass =
    balanceTotal < 0
      ? "text-negative"
      : balanceTotal > 0
        ? "text-positive"
        : "text-muted-foreground";
  // A month in progress always looks like a loss before payday, so say which
  // figure this is rather than letting the header imply a finished month.
  const subtitle = isCurrentYearView && lastCompleteMonth >= 0
    ? formatMonthRange(lastCompleteMonth)
    : isCurrentMonthView && !periodLabel
      ? "so far this month"
      : null;

  // Filter data - when collapsed, show nothing (title shows the balance); when expanded, show all except balance
  const filteredData = isDetailsExpanded
    ? totalsData.filter((item) => !item.isBalance)
    : [];

  return (
    <div className="bg-white dark:bg-gray-800 text-card-foreground rounded-2xl border shadow-sm p-4 sm:p-6">
      <button
        type="button"
        onClick={onToggleDetails}
        aria-expanded={isDetailsExpanded}
        className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span
              className={`block truncate text-sm font-medium ${
                periodLabel
                  ? "text-muted-foreground"
                  : isGains
                    ? "text-positive"
                    : "text-negative"
              }`}
            >
              {title}
            </span>
            {subtitle && (
              <span className="text-xs text-muted-foreground">{subtitle}</span>
            )}
          </div>
          {isDetailsExpanded ? (
            <ChevronUp size={18} className="shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown size={18} className="shrink-0 text-muted-foreground" />
          )}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className={`text-2xl font-semibold tabular-nums sm:text-3xl ${balanceClass}`}>
            <PrivacyBlur blur={privacyMode}>{signedBalance}</PrivacyBlur>
          </span>
          {expectedSplitAmountEur > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              <GitFork size={12} />
              <span>Split ·</span>
              <PrivacyBlur blur={privacyMode}>
                {formatAmount(Math.abs(expectedSplitAmountEur))}
              </PrivacyBlur>
            </span>
          )}
        </div>
      </button>
      <div className="mt-3 overflow-hidden">
        <table className="w-full">
          {currentYear !== undefined && isDetailsExpanded && (
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 sm:py-3 px-1 sm:px-2 font-medium text-muted-foreground text-sm sm:text-sm"></th>
                <th className="text-right py-2 sm:py-3 px-1 sm:px-2 font-medium text-muted-foreground text-sm sm:text-sm">
                  Total
                </th>
                <th className="text-right py-2 sm:py-3 px-1 sm:px-2 font-medium text-muted-foreground text-sm sm:text-sm">
                  Monthly
                </th>
                {previousYear !== undefined && (
                  <th className="text-right py-2 sm:py-3 px-1 sm:px-2 font-medium text-muted-foreground text-sm sm:text-sm">
                    vs {previousYear}
                  </th>
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

              const isIncomeRow = !!(item.isIncome || item.type === "income");
              const isExpenseRow = !!(item.isExpense || item.type === "expense");
              const labelClass = isMonthly
                ? isHiddenExpense
                  ? "text-muted-foreground"
                  : isSubCategory
                    ? "font-normal text-foreground"
                    : "font-medium text-foreground"
                : getCategoryNameClass(
                    !!isSubCategory,
                    !!isHiddenExpense,
                    item.isBalance || false,
                    item.isIncome || false,
                    item.total,
                  );
              const amountClass = isMonthly
                ? isIncomeRow
                  ? "text-positive"
                  : isExpenseRow
                    ? "text-negative"
                    : "text-muted-foreground"
                : getTotalAmountClass(
                    !!isSubCategory,
                    item.type || "",
                    !!isHiddenExpense,
                    item.isBalance || false,
                    item.isIncome || false,
                    item.total,
                  );

              return (
                <tr key={`${item.category}`}>
                  <td className="py-2 sm:py-3 px-1 sm:px-2">
                    <div className="flex items-center">
                      {isCollapsible && (
                        <button
                          onClick={handleToggleExpand}
                          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${item.category}`}
                          className="mr-2 flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {isExpanded ? (
                            <ChevronUp
                              size={16}
                              className="text-muted-foreground"
                            />
                          ) : (
                            <ChevronDown
                              size={16}
                              className="text-muted-foreground"
                            />
                          )}
                        </button>
                      )}
                      {isSubCategory && item.icon && (
                        <span className="mr-2 flex h-6 w-6 items-center justify-center">
                          <item.icon
                            size={16}
                            className="text-muted-foreground"
                          />
                        </span>
                      )}
                      <span className={labelClass}>{item.category}</span>
                    </div>
                  </td>
                  <td className="py-2 sm:py-3 px-1 sm:px-2 text-right">
                    <span className={amountClass}>
                      <PrivacyBlur blur={privacyMode}>
                        {`${isMonthly && isIncomeRow ? "+" : ""}${formatAmount(
                          Math.abs(item.total),
                        )}`}
                      </PrivacyBlur>
                    </span>
                  </td>
                  {currentYear !== undefined && (
                    <td className="py-2 sm:py-3 px-1 sm:px-2 text-right">
                      {isHiddenExpense ? (
                        <span className="text-muted-foreground text-sm sm:text-sm">
                          -
                        </span>
                      ) : (
                        <span
                          className={getMonthlyAmountClass(
                            item.isBalance || false,
                            item.monthlyAverage,
                          )}
                        >
                          <PrivacyBlur blur={privacyMode}>
                            {formatAmount(Math.abs(item.monthlyAverage || 0))}
                          </PrivacyBlur>
                        </span>
                      )}
                    </td>
                  )}
                  {currentYear !== undefined && previousYear !== undefined && (
                    <td className="py-2 sm:py-3 px-1 sm:px-2 text-right">
                      {renderComparisonCell(item, privacyMode)}
                    </td>
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
  readonly privacyMode: boolean;
};

function CategoriesTable({
  categoriesData,
  currentYear,
  previousYear,
  privacyMode,
}: CategoriesTableProps) {
  if (currentYear === undefined || categoriesData.length === 0) return null;
  return (
    <div className="bg-white dark:bg-gray-800 text-card-foreground rounded-xl border shadow-sm p-4 sm:p-6">
      <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
        Category Breakdown (€)
      </h3>
      <div className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 sm:py-3 px-1 sm:px-2 font-medium text-muted-foreground text-sm sm:text-sm"></th>
              <th className="text-right py-2 sm:py-3 px-1 sm:px-2 font-medium text-muted-foreground text-sm sm:text-sm">
                {currentYear ? "Monthly" : "Total"}
              </th>
              {currentYear !== undefined && previousYear !== undefined && (
                <th className="text-right py-2 sm:py-3 px-1 sm:px-2 font-medium text-muted-foreground text-sm sm:text-sm">
                  vs {previousYear}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {categoriesData.map((item) => (
              <tr
                key={`${item.type}-${item.category}`}
                className="border-b border-border last:border-b-0"
              >
                <td className="py-2 sm:py-3 px-1 sm:px-2">
                  <div className="flex items-center min-w-0">
                    <item.icon
                      size={14}
                      className="text-muted-foreground mr-1 sm:mr-3 flex-shrink-0 sm:w-5 sm:h-5"
                    />
                    <div
                      className={`relative min-w-0 flex-1 ${
                        currentYear !== undefined && previousYear !== undefined
                          ? "max-w-[140px] sm:max-w-[200px]"
                          : ""
                      }`}
                    >
                      <span
                        className={`font-medium text-sm sm:text-sm block ${
                          currentYear !== undefined &&
                          previousYear !== undefined
                            ? "overflow-hidden whitespace-nowrap"
                            : ""
                        } ${
                          item.type === "income"
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                        title={item.category}
                        style={
                          currentYear !== undefined &&
                          previousYear !== undefined
                            ? {
                                maskImage:
                                  "linear-gradient(to right, black 0%, black 85%, transparent 100%)",
                                WebkitMaskImage:
                                  "linear-gradient(to right, black 0%, black 85%, transparent 100%)",
                              }
                            : undefined
                        }
                      >
                        {item.category}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="py-2 sm:py-3 px-1 sm:px-2 text-right">
                  <span
                    className={`text-sm sm:text-sm ${
                      item.type === "income" ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    <PrivacyBlur blur={privacyMode}>
                      {formatAmount(
                        Math.abs(
                          currentYear ? item.monthlyAverage : item.total,
                        ),
                      )}
                    </PrivacyBlur>
                  </span>
                </td>
                {currentYear !== undefined && previousYear !== undefined && (
                  <td className="py-2 sm:py-3 px-1 sm:px-2 text-right">
                    {item.difference === null ? (
                      <span className="text-muted-foreground">-</span>
                    ) : (
                      formatDifference(
                        item.difference,
                        item.type === "income",
                        privacyMode,
                      )
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
  readonly currentYear?: number;
  readonly selectedMonth?: number;
  readonly selectedYear?: number;
  readonly expectedSplitAmountEur?: number;
};

export default function TransactionSummary({
  transactions,
  isLoading = false,
  currentYear,
  selectedMonth,
  selectedYear,
  expectedSplitAmountEur = 0,
}: TransactionSummaryProps) {
  // State for collapsible categories in monthly view
  const [isIncomeExpanded, setIsIncomeExpanded] = useState(false);
  const [isExpensesExpanded, setIsExpensesExpanded] = useState(false);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

  // Privacy mode
  const { privacyMode } = usePrivacyMode();

  // Fetch previous year data for comparison if currentYear is provided
  const previousYear = currentYear ? currentYear - 1 : undefined;
  const { transactions: previousYearTransactions } =
    useYearTransactions(previousYear);
  const comparisonYear = selectedYear ?? currentYear;
  const comparisonMonth = selectedMonth;

  // Determine if viewing the current year — cap at last complete month
  const isCurrentYearView = useMemo(
    () => currentYear !== undefined && currentYear === new Date().getFullYear(),
    [currentYear],
  );
  const lastCompleteMonth = useMemo(
    () =>
      isCurrentYearView ? new Date().getMonth() - 1 : 11, // 0-indexed
    [isCurrentYearView],
  );
  const numberOfMonths = lastCompleteMonth + 1;

  // Filter transactions to last complete month when viewing current year
  const effectiveTransactions = useMemo(
    () => filterTransactionsToLastCompleteMonth(transactions, lastCompleteMonth),
    [transactions, lastCompleteMonth],
  );

  const effectivePrevYearTransactions = useMemo(
    () =>
      filterTransactionsToLastCompleteMonth(
        previousYearTransactions || [],
        lastCompleteMonth,
      ),
    [previousYearTransactions, lastCompleteMonth],
  );

  // Memoize current year totals computation
  const {
    expenseTotal,
    incomeTotal,
    incomeCategoryTotals,
    expenseCategoryTotals,
    hiddenExpenseTotal,
  } = useMemo(
    () => computeYearTotals(effectiveTransactions),
    [effectiveTransactions],
  );

  // Memoize previous year totals computation
  const {
    prevYearExpenseTotal,
    prevYearIncomeTotal,
    prevYearIncomeCategoryTotals,
    prevYearExpenseCategoryTotals,
    prevYearHiddenExpenseTotal,
  } = useMemo(
    () => computePrevYearTotals(effectivePrevYearTransactions),
    [effectivePrevYearTransactions],
  );

  // Memoize balance calculations
  const { balanceTotal, prevYearBalanceTotal } = useMemo(
    () => ({
      balanceTotal: incomeTotal - expenseTotal,
      prevYearBalanceTotal: prevYearIncomeTotal - prevYearExpenseTotal,
    }),
    [incomeTotal, expenseTotal, prevYearIncomeTotal, prevYearExpenseTotal],
  );

  // Memoized toggle handlers
  const handleToggleIncome = useCallback(
    () => setIsIncomeExpanded((prev) => !prev),
    [],
  );
  const handleToggleExpenses = useCallback(
    () => setIsExpensesExpanded((prev) => !prev),
    [],
  );
  const handleToggleDetails = useCallback(
    () => setIsDetailsExpanded((prev) => !prev),
    [],
  );

  // Memoize base data creation (must be before conditional returns)
  const baseData = useMemo(
    () =>
      createBaseData({
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
        numberOfMonths,
      }),
    [
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
      numberOfMonths,
    ],
  );

  // Memoize totals data with category rows
  const totalsData = useMemo(
    () =>
      currentYear
        ? baseData
        : extendWithCategoryRows(
            baseData,
            isIncomeExpanded,
            isExpensesExpanded,
            incomeCategoryTotals,
            expenseCategoryTotals,
            numberOfMonths,
          ),
    [
      currentYear,
      baseData,
      isIncomeExpanded,
      isExpensesExpanded,
      incomeCategoryTotals,
      expenseCategoryTotals,
      numberOfMonths,
    ],
  );

  // Memoize categories data
  const categoriesData = useMemo(
    () =>
      buildCategoriesData(
        incomeCategoryTotals,
        expenseCategoryTotals,
        prevYearIncomeCategoryTotals,
        prevYearExpenseCategoryTotals,
        currentYear,
        previousYear,
        numberOfMonths,
      ),
    [
      incomeCategoryTotals,
      expenseCategoryTotals,
      prevYearIncomeCategoryTotals,
      prevYearExpenseCategoryTotals,
      currentYear,
      previousYear,
      numberOfMonths,
    ],
  );

  // Memoize hasData check
  const hasData = useMemo(
    () =>
      Object.keys(incomeCategoryTotals).length > 0 ||
      Object.keys(expenseCategoryTotals).length > 0,
    [incomeCategoryTotals, expenseCategoryTotals],
  );

  // Loading state (after all hooks)
  if (isLoading) {
    // Year view shows both totals and category breakdown
    if (currentYear !== undefined) {
      return <SummarySkeleton yearView={true} />;
    }
    // Monthly view shows collapsed summary
    return <SummarySkeleton collapsed={true} />;
  }

  const shouldShowTotals = currentYear === undefined || hasData;

  const monthViewNow = new Date();
  const isCurrentMonthView =
    currentYear === undefined &&
    comparisonYear === monthViewNow.getFullYear() &&
    comparisonMonth === monthViewNow.getMonth() + 1;
  const periodLabel =
    currentYear === undefined
      ? isCurrentMonthView
        ? "Net so far this month"
        : `Net · ${new Date(
            comparisonYear ?? monthViewNow.getFullYear(),
            (comparisonMonth ?? monthViewNow.getMonth() + 1) - 1,
            1,
          ).toLocaleDateString("en-GB", { month: "long" })}`
      : undefined;

  return (
    <div className="space-y-4 sm:space-y-6 py-2 sm:py-6">
      {shouldShowTotals && (
        <TotalsTable
          totalsData={totalsData}
          currentYear={currentYear}
          previousYear={previousYear}
          expectedSplitAmountEur={expectedSplitAmountEur}
          isIncomeExpanded={isIncomeExpanded}
          isExpensesExpanded={isExpensesExpanded}
          onToggleIncome={handleToggleIncome}
          onToggleExpenses={handleToggleExpenses}
          isDetailsExpanded={isDetailsExpanded}
          onToggleDetails={handleToggleDetails}
          privacyMode={privacyMode}
          isCurrentYearView={isCurrentYearView}
          lastCompleteMonth={lastCompleteMonth}
          isCurrentMonthView={isCurrentMonthView}
          periodLabel={periodLabel}
        />
      )}

      <CategoriesTable
        categoriesData={categoriesData}
        currentYear={currentYear}
        previousYear={previousYear}
        privacyMode={privacyMode}
      />

      {!hasData && currentYear !== undefined && (
        <div className="bg-white dark:bg-gray-800 text-card-foreground rounded-xl border shadow-sm p-6">
          <div className="text-center py-8 text-muted-foreground">
            No transactions this year
          </div>
        </div>
      )}
    </div>
  );
}

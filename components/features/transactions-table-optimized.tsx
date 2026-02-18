import React, { useMemo } from "react";
import { Transaction } from "@/types/database";
import {
  formatDate,
  formatDateHeader,
  formatDateHeaderWithYear,
} from "@/utils/date";
import { formatCurrency } from "@/utils/currency";
import { CATEGORY_ICONS } from "@/utils/categories";
import NoTransactions from "@/components/features/no-transactions";
import { DailyHiddenIndicator } from "@/components/ui/daily-hidden-indicator";
import { GitFork, LucideProps } from "lucide-react";
import { TransactionListSkeleton } from "@/components/ui/skeletons";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { PrivacyBlur } from "@/components/ui/privacy-blur";
import {
  getTransactionDisplayAmount,
  getTransactionDisplayEurAmount,
} from "@/utils/split-transactions";

type TransactionsTableProps = {
  readonly transactions: ReadonlyArray<Transaction>;
  readonly onTransactionClick?: (transaction: Transaction) => void;
  readonly onCategoryClick?: (category: string) => void;
  readonly onSubCategoryClick?: (category: string, subCategory: string) => void;
  readonly showYear?: boolean; // For search results - forces year display
  readonly isLoading?: boolean;
};

// Optimized transaction row component with new card design
const TransactionRow = React.memo(
  ({
    transaction,
    onClick,
    onCategoryClick,
    onSubCategoryClick,
    privacyMode,
  }: {
    readonly transaction: Transaction;
    readonly onClick: (transaction: Transaction) => void;
    readonly onCategoryClick?: (category: string) => void;
    readonly onSubCategoryClick?: (category: string, subCategory: string) => void;
    readonly privacyMode: boolean;
  }) => {
    const Icon: React.ComponentType<LucideProps> =
      CATEGORY_ICONS[transaction.main_category] || CATEGORY_ICONS["Services"];
    const amount =
      getTransactionDisplayEurAmount(transaction) ??
      getTransactionDisplayAmount(transaction);
    const showOriginalCurrency =
      (getTransactionDisplayEurAmount(transaction) ?? transaction.eur_amount) &&
      transaction.currency !== "EUR";

    // Handler for category icon click (navigates to main category)
    const handleCategoryClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onCategoryClick) {
        onCategoryClick(transaction.main_category);
      }
    };

    // Handler for subcategory text click (navigates to subcategory)
    const handleSubCategoryClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onSubCategoryClick && transaction.sub_category) {
        onSubCategoryClick(transaction.main_category, transaction.sub_category);
      }
    };

    return (
      <button
        type="button"
        onClick={() => onClick(transaction)}
        aria-label={`Open transaction ${transaction.title}`}
        className={`group w-full text-left bg-white dark:bg-gray-800 rounded-lg p-4 flex items-center shadow-sm hover:shadow-md transition-shadow cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 ${transaction.hide_from_totals ? "opacity-50" : ""
          } ${transaction.split_is_read_only ? "bg-gray-100 dark:bg-gray-800/70 grayscale-[0.2]" : ""
          }`}
      >
        <div
          onClick={onCategoryClick ? handleCategoryClick : undefined}
          className={`w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 ${onCategoryClick
              ? "cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              : ""
            }`}
          role={onCategoryClick ? "button" : undefined}
          tabIndex={onCategoryClick ? 0 : undefined}
          aria-label={
            onCategoryClick
              ? `View ${transaction.main_category} category`
              : undefined
          }
          onKeyDown={
            onCategoryClick
              ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  handleCategoryClick(
                    e as unknown as React.MouseEvent
                  );
                }
              }
              : undefined
          }
        >
          <Icon size={20} className="text-gray-500 dark:text-gray-400" />
        </div>
        <div className="ml-4 flex-1 min-w-0 overflow-hidden">
          <div className="relative">
            <p className="font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap overflow-hidden uppercase flex items-center gap-2">
              <span>{transaction.title}</span>
              {transaction.split_across_year && (
                <GitFork
                  size={14}
                  className="text-gray-400 dark:text-gray-500 flex-shrink-0"
                  aria-label="Split transaction"
                />
              )}
            </p>
            <div className="absolute right-0 top-0 w-8 h-full bg-gradient-to-l from-white dark:from-gray-800 via-white/60 dark:via-gray-800/60 to-transparent pointer-events-none"></div>
          </div>
          <p
            onClick={onSubCategoryClick && transaction.sub_category ? handleSubCategoryClick : undefined}
            className={`text-sm text-gray-500 dark:text-gray-400 truncate w-fit max-w-full ${onSubCategoryClick && transaction.sub_category
                ? "cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                : ""
              }`}
            role={onSubCategoryClick && transaction.sub_category ? "button" : undefined}
            tabIndex={onSubCategoryClick && transaction.sub_category ? 0 : undefined}
            aria-label={
              onSubCategoryClick && transaction.sub_category
                ? `View ${transaction.sub_category} subcategory`
                : undefined
            }
            onKeyDown={
              onSubCategoryClick && transaction.sub_category
                ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    handleSubCategoryClick(
                      e as unknown as React.MouseEvent
                    );
                  }
                }
                : undefined
            }
          >
            {transaction.sub_category}
          </p>
        </div>
        <div className="flex-shrink-0 ml-4">
          <p
            className={`font-medium text-right ${transaction.is_money_transfer
                ? "text-gray-900 dark:text-white"
                : transaction.type === "expense"
                  ? "text-red-500"
                  : "text-green-500"
              }`}
          >
            <PrivacyBlur blur={privacyMode && transaction.type === "income"}>
              {formatCurrency(
                amount,
                showOriginalCurrency ? "EUR" : transaction.currency
              )}
            </PrivacyBlur>
          </p>
          {showOriginalCurrency && (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-right">
              <PrivacyBlur blur={privacyMode && transaction.type === "income"}>
                ({formatCurrency(
                  getTransactionDisplayAmount(transaction),
                  transaction.currency
                )})
              </PrivacyBlur>
            </p>
          )}
        </div>
      </button>
    );
  }
);

TransactionRow.displayName = "TransactionRow";

// Optimized date group component with sticky headers
const DateGroup = React.memo(
  ({
    date,
    transactions,
    dailyTotal,
    onTransactionClick,
    onCategoryClick,
    onSubCategoryClick,
    showYear = false,
    privacyMode,
  }: {
    readonly date: string;
    readonly transactions: ReadonlyArray<Transaction>;
    readonly dailyTotal: number;
    readonly onTransactionClick: (transaction: Transaction) => void;
    readonly onCategoryClick?: (category: string) => void;
    readonly onSubCategoryClick?: (category: string, subCategory: string) => void;
    readonly showYear?: boolean;
    readonly privacyMode: boolean;
  }) => {
    // Calculate hidden transactions count for this day
    const hiddenCount = transactions.filter((t) => t.hide_from_totals).length;

    return (
      <div className="mb-3">
        {/* Sticky Date Header */}
        <div className="sticky top-[63px] z-[45] bg-gray-50/95 dark:bg-gray-900/95 py-3 flex justify-between items-center border-b border-gray-200 dark:border-gray-700 -mx-6 px-6 backdrop-blur-sm">
          <div className="flex items-center">
            <h3 className="font-semibold text-gray-600 dark:text-gray-400">
              {showYear
                ? formatDateHeaderWithYear(transactions[0].date)
                : formatDateHeader(transactions[0].date)}
            </h3>
            <DailyHiddenIndicator count={hiddenCount} />
          </div>
          <span
            className={`font-semibold ${dailyTotal >= 0 ? "text-green-500" : "text-red-500"
              }`}
          >
            <PrivacyBlur blur={privacyMode}>
              {formatCurrency(Math.abs(dailyTotal), "EUR")}
            </PrivacyBlur>
          </span>
        </div>

        {/* Transactions List */}
        <div className="mt-4 space-y-2">
          {transactions.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              onClick={onTransactionClick}
              onCategoryClick={onCategoryClick}
              onSubCategoryClick={onSubCategoryClick}
              privacyMode={privacyMode}
            />
          ))}
        </div>
      </div>
    );
  }
);

DateGroup.displayName = "DateGroup";

export default function TransactionsTable({
  transactions,
  onTransactionClick,
  onCategoryClick,
  onSubCategoryClick,
  showYear = false,
  isLoading = false,
}: TransactionsTableProps) {
  const { privacyMode } = usePrivacyMode();

  const groupedData = useMemo(() => {
    if (!transactions.length) return {};

    return transactions.reduce((groups, transaction) => {
      const date = formatDate(transaction.date);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(transaction);
      return groups;
    }, {} as Record<string, Transaction[]>);
  }, [transactions]);

  const handleTransactionClick = React.useCallback(
    (transaction: Transaction) => {
      if (onTransactionClick) {
        onTransactionClick(transaction);
      }
    },
    [onTransactionClick]
  );

  if (isLoading) {
    return <TransactionListSkeleton count={10} />;
  }

  if (transactions.length === 0) {
    return <NoTransactions />;
  }

  return (
    <div className="space-y-3">
      {Object.entries(groupedData).map(([date, dateTransactions]) => {
        const dailyTotal = dateTransactions.reduce((total, t) => {
          // Skip transactions that are hidden from totals or are money transfers
          if (t.hide_from_totals || t.is_money_transfer) return total;

          const amount =
            getTransactionDisplayEurAmount(t) ??
            (t.currency === "EUR" ? getTransactionDisplayAmount(t) : 0);
          return total + (t.type === "expense" ? -amount : amount);
        }, 0);

        return (
          <DateGroup
            key={date}
            date={date}
            transactions={dateTransactions}
            dailyTotal={dailyTotal}
            onTransactionClick={handleTransactionClick}
            onCategoryClick={onCategoryClick}
            onSubCategoryClick={onSubCategoryClick}
            showYear={showYear}
            privacyMode={privacyMode}
          />
        );
      })}
    </div>
  );
}

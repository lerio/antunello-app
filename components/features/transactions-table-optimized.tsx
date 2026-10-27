import React, { useMemo } from "react";
import { Transaction } from "@/types/database";
import {
  formatDate,
  formatDateHeader,
  formatDateHeaderWithYear,
} from "@/utils/date";
import { formatCurrency } from "@/utils/currency";
import { getTransactionIcon } from "@/utils/categories";
import { DailyHiddenIndicator } from "@/components/ui/daily-hidden-indicator";
import { ArrowRightLeft, GitFork, LucideProps } from "lucide-react";
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
  /** Empty-state sentence, e.g. "No transactions in October". */
  readonly emptyMessage?: string;
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
    const Icon: React.ComponentType<LucideProps> = getTransactionIcon(
      transaction.main_category,
      transaction.sub_category,
    );
    const amount =
      getTransactionDisplayEurAmount(transaction) ??
      getTransactionDisplayAmount(transaction);
    const showOriginalCurrency =
      (getTransactionDisplayEurAmount(transaction) ?? transaction.eur_amount) &&
      transaction.currency !== "EUR";
    const isSplit = transaction.split_across_year === true;
    const isIncome = transaction.type === "income";
    const isExpense = transaction.type === "expense";
    const isTransfer = transaction.is_money_transfer === true;
    const subtitle = isTransfer
      ? "Movement"
      : transaction.sub_category || transaction.main_category;
    // Every expense is red; movements stay neutral because no money leaves.
    const amountColor = isTransfer
      ? "text-muted-foreground"
      : isExpense
        ? "text-negative"
        : "text-positive";
    const dateLabel = new Date(transaction.date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
    });
    const amountLabel = `${isIncome ? "+" : ""}${formatCurrency(
      Math.abs(amount),
      showOriginalCurrency ? "EUR" : transaction.currency,
    )}`;

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
        aria-label={
          privacyMode
            ? `${transaction.title}, ${subtitle}, amount hidden, ${dateLabel}`
            : `${transaction.title}, ${subtitle}, ${amountLabel}, ${dateLabel}`
        }
        aria-disabled={transaction.split_is_read_only || undefined}
        className={`group flex min-h-16 w-full cursor-pointer items-center p-4 text-left transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring dark:hover:bg-gray-700/40 ${
          transaction.hide_from_totals
            ? "opacity-50"
            : isSplit
              ? "bg-muted/40"
              : ""
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
          {isTransfer ? (
            <ArrowRightLeft size={20} className="text-gray-500 dark:text-gray-400" />
          ) : (
            <Icon size={20} className="text-gray-500 dark:text-gray-400" />
          )}
        </div>
        <div className="ml-4 flex-1 min-w-0 overflow-hidden">
          <p className="truncate font-medium text-gray-800 dark:text-gray-200 uppercase">
            {transaction.title}
          </p>
          <div className="flex items-center gap-1.5">
            <p
              onClick={
                !isTransfer && onSubCategoryClick && transaction.sub_category
                  ? handleSubCategoryClick
                  : undefined
              }
              className={`text-sm text-gray-500 dark:text-gray-400 truncate w-fit max-w-full min-w-0 ${!isTransfer && onSubCategoryClick && transaction.sub_category
                  ? "cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  : ""
                }`}
              role={!isTransfer && onSubCategoryClick && transaction.sub_category ? "button" : undefined}
              tabIndex={!isTransfer && onSubCategoryClick && transaction.sub_category ? 0 : undefined}
              aria-label={
                !isTransfer && onSubCategoryClick && transaction.sub_category
                  ? `View ${transaction.sub_category} subcategory`
                  : undefined
              }
              onKeyDown={
                !isTransfer && onSubCategoryClick && transaction.sub_category
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
              {subtitle}
            </p>
            {(isSplit || transaction.split_remaining_count) && (
              <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-medium leading-none text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                <GitFork size={12} aria-hidden />
                {transaction.split_remaining_count
                  ? `Split · ${transaction.split_remaining_count} left`
                  : "Split"}
              </span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 ml-4">
          <p className={`text-right font-medium ${amountColor}`}>
            <PrivacyBlur blur={privacyMode}>{amountLabel}</PrivacyBlur>
          </p>
          {showOriginalCurrency && (
            <p className="text-right text-xs text-gray-400 dark:text-gray-500">
              <PrivacyBlur blur={privacyMode}>
                {formatCurrency(
                  Math.abs(getTransactionDisplayAmount(transaction)),
                  transaction.currency
                )}
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
    transactions,
    dailyTotal,
    dailySplitTotal,
    onTransactionClick,
    onCategoryClick,
    onSubCategoryClick,
    showYear = false,
    privacyMode,
  }: {
    readonly transactions: ReadonlyArray<Transaction>;
    readonly dailyTotal: number;
    readonly dailySplitTotal: number;
    readonly onTransactionClick: (transaction: Transaction) => void;
    readonly onCategoryClick?: (category: string) => void;
    readonly onSubCategoryClick?: (category: string, subCategory: string) => void;
    readonly showYear?: boolean;
    readonly privacyMode: boolean;
  }) => {
    // Calculate hidden transactions count for this day
    const hiddenCount = transactions.filter((t) => t.hide_from_totals).length;

    return (
      <div className="mb-6">
        {/* Sticky Date Header */}
        <div className="sticky top-[52px] z-[45] flex items-center justify-between gap-2 bg-gray-50/95 py-3 backdrop-blur-sm dark:bg-gray-900/95">
          <div className="flex items-center">
            <h3 className="font-semibold text-gray-600 dark:text-gray-400">
              {showYear
                ? formatDateHeaderWithYear(transactions[0].date)
                : formatDateHeader(transactions[0].date)}
            </h3>
            <DailyHiddenIndicator count={hiddenCount} />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span
              className={`font-semibold ${
                dailyTotal === 0
                  ? "text-muted-foreground"
                  : dailyTotal > 0
                    ? "text-positive"
                    : "text-negative"
              }`}
            >
              <PrivacyBlur blur={privacyMode}>
                {`${dailyTotal > 0 ? "+" : ""}${formatCurrency(
                  Math.abs(dailyTotal),
                  "EUR",
                )}`}
              </PrivacyBlur>
            </span>
            {dailySplitTotal !== 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                <GitFork size={12} aria-hidden />
                <span>Split ·</span>
                <PrivacyBlur blur={privacyMode}>
                  {formatCurrency(Math.abs(dailySplitTotal), "EUR")}
                </PrivacyBlur>
              </span>
            )}
          </div>
        </div>

        {/* Transactions List */}
        <div className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-white dark:bg-gray-800">
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
  emptyMessage = "No transactions found",
}: TransactionsTableProps): React.ReactElement {
  const { privacyMode } = usePrivacyMode();

  const groupedData = useMemo(() => {
    if (!transactions.length) return [];

    const groups: Record<string, { transactions: Transaction[]; dailyTotal: number; dailySplitTotal: number }> = {};

    for (const transaction of transactions) {
      const date = formatDate(transaction.date);
      if (!groups[date]) {
        groups[date] = { transactions: [], dailyTotal: 0, dailySplitTotal: 0 };
      }

      groups[date].transactions.push(transaction);

      // Skip transactions that are hidden from totals or are money transfers
      if (!transaction.hide_from_totals && !transaction.is_money_transfer) {
        const amount =
          getTransactionDisplayEurAmount(transaction) ??
          (transaction.currency === "EUR" ? getTransactionDisplayAmount(transaction) : 0);
        const signedAmount = transaction.type === "expense" ? -amount : amount;

        if (transaction.split_across_year) {
          groups[date].dailySplitTotal += signedAmount;
        } else {
          groups[date].dailyTotal += signedAmount;
        }
      }
    }

    return Object.entries(groups).map(([date, data]) => ({
      date,
      transactions: data.transactions,
      dailyTotal: data.dailyTotal,
      dailySplitTotal: data.dailySplitTotal,
    }));
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
    return <TransactionListSkeleton count={3} />;
  }

  if (transactions.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {groupedData.map(({ date, transactions: dateTransactions, dailyTotal, dailySplitTotal }) => (
        <DateGroup
          key={date}
          transactions={dateTransactions}
          dailyTotal={dailyTotal}
          dailySplitTotal={dailySplitTotal}
          onTransactionClick={handleTransactionClick}
          onCategoryClick={onCategoryClick}
          onSubCategoryClick={onSubCategoryClick}
          showYear={showYear}
          privacyMode={privacyMode}
        />
      ))}
    </div>
  );
}

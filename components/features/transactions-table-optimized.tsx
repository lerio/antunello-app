import React, { useMemo } from "react";
import { Transaction } from "@/types/database";
import { formatDate, formatDateHeader, formatDateHeaderWithYear } from "@/utils/date";
import { formatCurrency } from "@/utils/currency";
import { CATEGORY_ICONS } from "@/utils/categories";
import NoTransactions from "@/components/features/no-transactions";
import { DailyHiddenIndicator } from "@/components/ui/daily-hidden-indicator";
import { LucideProps } from "lucide-react";

type TransactionsTableProps = {
  readonly transactions: ReadonlyArray<Transaction>;
  readonly onTransactionClick?: (transaction: Transaction) => void;
  readonly showYear?: boolean; // For search results - forces year display
};

// Optimized transaction row component with new card design
const TransactionRow = React.memo(
  ({
    transaction,
    onClick,
  }: {
    readonly transaction: Transaction;
    readonly onClick: (transaction: Transaction) => void;
  }) => {
    const Icon: React.ComponentType<LucideProps> =
      CATEGORY_ICONS[transaction.main_category] || CATEGORY_ICONS["Services"];
    const amount = transaction.eur_amount || transaction.amount;
    const showOriginalCurrency =
      transaction.eur_amount && transaction.currency !== "EUR";

    return (
      <button
        type="button"
        onClick={() => onClick(transaction)}
        aria-label={`Open transaction ${transaction.title}`}
        className={`group w-full text-left bg-white dark:bg-gray-800 rounded-lg p-4 flex items-center shadow-sm hover:shadow-md transition-shadow cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 ${transaction.hide_from_totals ? 'opacity-50' : ''
          }`}
      >
        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
          <Icon size={20} className="text-gray-500 dark:text-gray-400" />
        </div>
        <div className="ml-4 flex-1 min-w-0 overflow-hidden">
          <div className="relative">
            <p className="font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap overflow-hidden">
              {transaction.title}
            </p>
            <div className="absolute right-0 top-0 w-8 h-full bg-gradient-to-l from-white dark:from-gray-800 via-white/60 dark:via-gray-800/60 to-transparent pointer-events-none"></div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {transaction.sub_category}
          </p>
        </div>
        <div className="flex-shrink-0 ml-4">
          <p
            className={`font-medium text-right ${transaction.type === "expense" ? "text-red-500" : "text-green-500"
              }`}
          >
            {formatCurrency(
              amount,
              showOriginalCurrency ? "EUR" : transaction.currency
            )}
          </p>
          {showOriginalCurrency && (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-right">
              ({formatCurrency(transaction.amount, transaction.currency)})
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
    showYear = false,
  }: {
    readonly date: string;
    readonly transactions: ReadonlyArray<Transaction>;
    readonly dailyTotal: number;
    readonly onTransactionClick: (transaction: Transaction) => void;
    readonly showYear?: boolean;
  }) => {
    // Calculate hidden transactions count for this day
    const hiddenCount = transactions.filter(t => t.hide_from_totals).length;

    return (
      <div className="mb-6">
        {/* Sticky Date Header */}
        <div className="sticky top-[66px] z-[45] bg-gray-50/95 dark:bg-gray-900/95 py-3 flex justify-between items-center border-b border-gray-200 dark:border-gray-700 -mx-6 px-6 backdrop-blur-sm">
          <div className="flex items-center">
            <h3 className="font-semibold text-gray-600 dark:text-gray-400">
              {showYear ? formatDateHeaderWithYear(transactions[0].date) : formatDateHeader(transactions[0].date)}
            </h3>
            <DailyHiddenIndicator count={hiddenCount} />
          </div>
          <span
            className={`font-semibold ${dailyTotal >= 0 ? "text-green-500" : "text-red-500"
              }`}
          >
            {formatCurrency(Math.abs(dailyTotal), "EUR")}
          </span>
        </div>

        {/* Transactions List */}
        <div className="mt-4 space-y-4">
          {transactions.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              onClick={onTransactionClick}
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
  showYear = false,
}: TransactionsTableProps) {
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

  if (transactions.length === 0) {
    return <NoTransactions />;
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedData).map(([date, dateTransactions]) => {
        const dailyTotal = dateTransactions.reduce((total, t) => {
          // Skip transactions that are hidden from totals
          if (t.hide_from_totals) return total;

          const amount = t.eur_amount || (t.currency === "EUR" ? t.amount : 0);
          return total + (t.type === "expense" ? -amount : amount);
        }, 0);

        return (
          <DateGroup
            key={date}
            date={date}
            transactions={dateTransactions}
            dailyTotal={dailyTotal}
            onTransactionClick={handleTransactionClick}
            showYear={showYear}
          />
        );
      })}
    </div>
  );
}

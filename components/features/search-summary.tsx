import { Transaction } from "@/types/database";
import { formatCurrency } from "@/utils/currency";
import { HiddenTransactionsTooltip } from "@/components/ui/hidden-transactions-tooltip";

function LoadingSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-8">
      <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded animate-pulse w-20"></div>
        <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded animate-pulse w-24"></div>
      </div>
      <div className="mt-4 space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-5 bg-gray-300 dark:bg-gray-700 rounded animate-pulse w-20"></div>
          <div className="h-5 bg-gray-300 dark:bg-gray-700 rounded animate-pulse w-24"></div>
        </div>
        <div className="flex justify-between items-center">
          <div className="h-5 bg-gray-300 dark:bg-gray-700 rounded animate-pulse w-28"></div>
          <div className="h-5 bg-gray-300 dark:bg-gray-700 rounded animate-pulse w-24"></div>
        </div>
      </div>
    </div>
  );
}

type SearchSummaryProps = {
  readonly transactions: ReadonlyArray<Transaction>;
  readonly isLoading?: boolean;
};

export default function SearchSummary({
  transactions,
  isLoading = false,
}: SearchSummaryProps) {
  // Use EUR as the unified currency for all calculations
  let expenseTotal = 0;
  let incomeTotal = 0;

  // Track hidden transactions
  let hiddenExpenseTotal = 0;
  let hiddenIncomeTotal = 0;
  let hiddenTransactionCount = 0;

  // Calculate totals using EUR amounts
  for (const transaction of transactions) {
    // Use EUR amount if available, otherwise fall back to original amount (assuming EUR)
    const eurAmount =
      transaction.eur_amount ||
      (transaction.currency === "EUR" ? transaction.amount : 0);

    // Skip transactions without EUR conversion (to avoid incorrect totals)
    if (eurAmount === 0 && transaction.currency !== "EUR") {
      continue;
    }

    // Handle hidden transactions separately
    if (transaction.hide_from_totals) {
      hiddenTransactionCount++;
      if (transaction.type === "expense") {
        hiddenExpenseTotal += eurAmount;
      } else {
        hiddenIncomeTotal += eurAmount;
      }
      continue;
    }

    // Update expense/income totals
    if (transaction.type === "expense") {
      expenseTotal += eurAmount;
    } else {
      incomeTotal += eurAmount;
    }
  }

  // Calculate balance
  const balanceTotal = incomeTotal - expenseTotal;

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (transactions.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-8">
      {/* Balance Row */}
      <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center">
          <span className="text-lg font-medium text-gray-600 dark:text-gray-400">
            Balance
          </span>
          <HiddenTransactionsTooltip
            count={hiddenTransactionCount}
            hiddenIncomeTotal={hiddenIncomeTotal}
            hiddenExpenseTotal={hiddenExpenseTotal}
          />
        </div>
        <span
          className={`text-lg font-bold ${
            balanceTotal >= 0 ? "text-green-500" : "text-red-500"
          }`}
        >
          {formatCurrency(Math.abs(balanceTotal), "EUR")}
        </span>
      </div>

      <div className="mt-4 space-y-4">
        {/* Income */}
        {incomeTotal > 0 && (
          <div className="flex justify-between items-center">
            <span className="font-medium text-gray-800 dark:text-gray-200">
              Income
            </span>
            <span className="font-medium text-green-500">
              {formatCurrency(incomeTotal, "EUR")}
            </span>
          </div>
        )}

        {/* Expenses */}
        {expenseTotal > 0 && (
          <div className="flex justify-between items-center">
            <span className="font-medium text-gray-800 dark:text-gray-200">
              Expenses
            </span>
            <span className="font-medium text-red-500">
              {formatCurrency(expenseTotal, "EUR")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

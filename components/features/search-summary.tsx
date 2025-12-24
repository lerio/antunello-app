import { Transaction } from "@/types/database";
import { formatCurrency } from "@/utils/currency";
import { HiddenTransactionsTooltip } from "@/components/ui/hidden-transactions-tooltip";
import { SummarySkeleton } from "@/components/ui/skeletons";

type SearchTotals = {
  expenseTotal: number;
  incomeTotal: number;
  hiddenExpenseTotal: number;
  hiddenIncomeTotal: number;
  hiddenTransactionCount: number;
};

function computeSearchTotals(transactions: ReadonlyArray<Transaction>): SearchTotals {
  let expenseTotal = 0;
  let incomeTotal = 0;
  let hiddenExpenseTotal = 0;
  let hiddenIncomeTotal = 0;
  let hiddenTransactionCount = 0;

  for (const transaction of transactions) {
    // Skip money transfers - they don't represent actual income/expenses
    if (transaction.is_money_transfer) continue;

    const eurAmount = transaction.eur_amount || (transaction.currency === "EUR" ? transaction.amount : 0);
    if (eurAmount === 0 && transaction.currency !== "EUR") continue;

    if (transaction.hide_from_totals) {
      hiddenTransactionCount++;
      if (transaction.type === "expense") {
        hiddenExpenseTotal += eurAmount;
      } else {
        hiddenIncomeTotal += eurAmount;
      }
      continue;
    }

    if (transaction.type === "expense") {
      expenseTotal += eurAmount;
    } else {
      incomeTotal += eurAmount;
    }
  }

  return { expenseTotal, incomeTotal, hiddenExpenseTotal, hiddenIncomeTotal, hiddenTransactionCount };
}


type SearchSummaryProps = {
  readonly transactions: ReadonlyArray<Transaction>;
  readonly isLoading?: boolean;
};

type SummaryCardProps = {
  readonly balanceTotal: number;
  readonly hiddenTransactionCount: number;
  readonly hiddenIncomeTotal: number;
  readonly hiddenExpenseTotal: number;
  readonly incomeTotal: number;
  readonly expenseTotal: number;
};

function SummaryCard({
  balanceTotal,
  hiddenTransactionCount,
  hiddenIncomeTotal,
  hiddenExpenseTotal,
  incomeTotal,
  expenseTotal,
}: SummaryCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-8">
      <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center">
          <span className="text-lg font-medium text-gray-600 dark:text-gray-400">Balance</span>
          <HiddenTransactionsTooltip
            count={hiddenTransactionCount}
            hiddenIncomeTotal={hiddenIncomeTotal}
            hiddenExpenseTotal={hiddenExpenseTotal}
          />
        </div>
        <span className={`text-lg font-bold ${balanceTotal >= 0 ? "text-green-500" : "text-red-500"}`}>
          {formatCurrency(Math.abs(balanceTotal), "EUR")}
        </span>
      </div>

      <div className="mt-4 space-y-4">
        {incomeTotal > 0 && (
          <div className="flex justify-between items-center">
            <span className="font-medium text-gray-800 dark:text-gray-200">Income</span>
            <span className="font-medium text-green-500">{formatCurrency(incomeTotal, "EUR")}</span>
          </div>
        )}

        {expenseTotal > 0 && (
          <div className="flex justify-between items-center">
            <span className="font-medium text-gray-800 dark:text-gray-200">Expenses</span>
            <span className="font-medium text-red-500">{formatCurrency(expenseTotal, "EUR")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchSummary({
  transactions,
  isLoading = false,
}: SearchSummaryProps) {
  const { expenseTotal, incomeTotal, hiddenExpenseTotal, hiddenIncomeTotal, hiddenTransactionCount } = computeSearchTotals(transactions);
  const balanceTotal = incomeTotal - expenseTotal;

  if (isLoading) return <SummarySkeleton />;
  if (transactions.length === 0) return null;

  return (
    <SummaryCard
      balanceTotal={balanceTotal}
      hiddenTransactionCount={hiddenTransactionCount}
      hiddenIncomeTotal={hiddenIncomeTotal}
      hiddenExpenseTotal={hiddenExpenseTotal}
      incomeTotal={incomeTotal}
      expenseTotal={expenseTotal}
    />
  );
}

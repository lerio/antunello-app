import { Transaction } from "@/types/database";
import { formatCurrency } from "@/utils/currency";
import { HiddenTransactionsTooltip } from "@/components/ui/hidden-transactions-tooltip";
import { SummarySkeleton } from "@/components/ui/skeletons";
import {
  getTransactionDisplayAmount,
  getTransactionDisplayEurAmount,
} from "@/utils/split-transactions";

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

    const eurAmount =
      getTransactionDisplayEurAmount(transaction) ||
      (transaction.currency === "EUR"
        ? getTransactionDisplayAmount(transaction)
        : 0);
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
    <div className="bg-white dark:bg-gray-800 text-card-foreground rounded-2xl border shadow-sm p-4 sm:p-6 tabular-nums">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold m-0">Balance</h3>
        <HiddenTransactionsTooltip
          count={hiddenTransactionCount}
          hiddenIncomeTotal={hiddenIncomeTotal}
          hiddenExpenseTotal={hiddenExpenseTotal}
        />
      </div>

      <div className="mt-1">
        <span className="text-3xl font-semibold">
          {formatCurrency(Math.abs(balanceTotal), "EUR")}
        </span>
        <span className={`ml-2 text-sm ${balanceTotal >= 0 ? "text-positive" : "text-negative"}`}>
          {balanceTotal >= 0 ? "+" : ""}{formatCurrency(balanceTotal, "EUR")}
        </span>
      </div>

      <div className="mt-3 divide-y divide-border border-t border-border">
        {incomeTotal > 0 && (
          <div className="flex items-baseline justify-between gap-3 py-2">
            <span className="text-xs text-muted-foreground">Income</span>
            <span className="shrink-0 text-sm font-medium text-positive">
              +{formatCurrency(incomeTotal, "EUR")}
            </span>
          </div>
        )}

        {expenseTotal > 0 && (
          <div className="flex items-baseline justify-between gap-3 py-2">
            <span className="text-xs text-muted-foreground">Expenses</span>
            <span className="shrink-0 text-sm font-medium text-negative">
              -{formatCurrency(expenseTotal, "EUR")}
            </span>
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

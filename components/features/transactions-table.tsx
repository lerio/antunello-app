import React from "react";
import { useRouter } from "next/navigation";
import { Transaction } from "@/types/database";
import { formatDate } from "@/utils/date";
import { formatCurrency } from "@/utils/currency";
import { LucideProps } from "lucide-react";
import { CATEGORY_ICONS } from "@/utils/categories";
import NoTransactions from "@/components/features/no-transactions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type TransactionsTableProps = {
  transactions: Transaction[];
};

type GroupedTransactions = {
  [date: string]: Transaction[];
};

export default function TransactionsTable({
  transactions,
}: TransactionsTableProps) {
  const router = useRouter();

  if (transactions.length === 0) {
    return <NoTransactions />;
  }

  const groupedTransactions = transactions.reduce(
    (groups: GroupedTransactions, transaction) => {
      const date = formatDate(transaction.date);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(transaction);
      return groups;
    },
    {}
  );

  // Calculate daily totals using EUR amounts
  const calculateDailyTotal = (dateTransactions: Transaction[]): number => {
    return dateTransactions.reduce((total, transaction) => {
      // Use EUR amount if available, otherwise fall back to original amount (assuming EUR)
      const eurAmount =
        transaction.eur_amount ||
        (transaction.currency === "EUR" ? transaction.amount : 0);

      // Skip transactions without EUR conversion (to avoid incorrect totals)
      if (eurAmount === 0 && transaction.currency !== "EUR") {
        return total;
      }

      return total + (transaction.type === "expense" ? -eurAmount : eurAmount);
    }, 0);
  };

  return (
    <div className="w-full">
      <div className="hidden md:block">
        {Object.entries(groupedTransactions).map(([date, dateTransactions]) => {
          const dailyTotal = calculateDailyTotal(dateTransactions);
          return (
            <div key={date} className="mb-2">
              <div className="px-4 py-3 text-sm font-medium flex justify-between items-center sticky-date-header rounded-t-lg">
                <span className="text-gray-500 dark:text-gray-400 font-medium">
                  {date}
                </span>
                <span
                  className={`font-semibold ${dailyTotal >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                >
                  {formatCurrency(Math.abs(dailyTotal), "EUR")}
                </span>
              </div>
              <Card className="rounded-t-none border-t-0">
                <CardContent className="divide-y divide-gray-200 dark:divide-gray-700 p-0">
                  {dateTransactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      onClick={() =>
                        router.push(`/protected/edit/${transaction.id}`)
                      }
                      className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors px-4 py-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                          {React.createElement(
                            CATEGORY_ICONS[transaction.main_category] ||
                              CATEGORY_ICONS["Services"],
                            { size: 16 } as LucideProps
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                            {transaction.title}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                            {transaction.sub_category}
                          </div>
                        </div>
                      </div>
                      <div className="text-right font-medium ml-4">
                        <div
                          className={`truncate ${transaction.type === "expense" ? "text-red-600" : "text-green-600"}`}
                        >
                          {transaction.eur_amount &&
                          transaction.currency !== "EUR" ? (
                            <span>
                              <span className="text-xs text-muted-foreground mr-1">
                                (
                                {formatCurrency(
                                  transaction.amount,
                                  transaction.currency
                                )}
                                )
                              </span>
                              {formatCurrency(transaction.eur_amount, "EUR")}
                            </span>
                          ) : (
                            formatCurrency(
                              transaction.amount,
                              transaction.currency
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      <div className="block md:hidden">
        {Object.entries(groupedTransactions).map(([date, dateTransactions]) => {
          const dailyTotal = calculateDailyTotal(dateTransactions);
          return (
            <div key={date}>
              <div className="px-3 py-3 text-sm font-medium rounded-t-lg flex justify-between items-center sticky-date-header">
                <span className="text-gray-500 dark:text-gray-400 font-medium">
                  {date}
                </span>
                <span
                  className={`font-semibold ${dailyTotal >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                >
                  {formatCurrency(Math.abs(dailyTotal), "EUR")}
                </span>
              </div>
              <ul className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900 rounded-b-lg overflow-hidden">
                {dateTransactions.map((transaction) => (
                  <li
                    key={transaction.id}
                    onClick={() =>
                      router.push(`/protected/edit/${transaction.id}`)
                    }
                    className="px-3 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0 overflow-hidden">
                      <div className="flex-shrink-0 h-7 w-7 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 mt-0.5">
                        {React.createElement(
                          CATEGORY_ICONS[transaction.main_category] ||
                            CATEGORY_ICONS["Services"],
                          { size: 14 } as LucideProps
                        )}
                      </div>
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="flex items-start justify-between gap-2 overflow-hidden">
                          <div className="min-w-0 flex-1 overflow-hidden max-w-[140px] sm:max-w-[240px]">
                            <div className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">
                              {transaction.title}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {transaction.sub_category}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div
                              className={`font-semibold text-sm ${transaction.type === "expense" ? "text-red-600" : "text-green-600"}`}
                            >
                              {transaction.eur_amount &&
                              transaction.currency !== "EUR" ? (
                                <div className="flex flex-col">
                                  <span className="text-xs text-muted-foreground">
                                    (
                                    {formatCurrency(
                                      transaction.amount,
                                      transaction.currency
                                    )}
                                    )
                                  </span>
                                  <span>
                                    {formatCurrency(
                                      transaction.eur_amount,
                                      "EUR"
                                    )}
                                  </span>
                                </div>
                              ) : (
                                formatCurrency(
                                  transaction.amount,
                                  transaction.currency
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

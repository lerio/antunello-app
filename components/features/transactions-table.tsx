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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Transactions</CardTitle>
      </CardHeader>
      <CardContent className="w-full">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full divide-y divide-gray-200 dark:divide-gray-700 table-fixed">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  style={{ width: "70%" }}
                >
                  Transaction
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                  style={{ width: "30%" }}
                >
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {Object.entries(groupedTransactions).map(
                ([date, dateTransactions]) => (
                  <React.Fragment key={date}>
                    <tr className="bg-gray-50 dark:bg-gray-800/50">
                      <td
                        colSpan={2}
                        className="px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400"
                      >
                        {date}
                      </td>
                    </tr>
                    {dateTransactions.map((transaction) => (
                      <tr
                        key={transaction.id}
                        onClick={() =>
                          router.push(`/protected/edit/${transaction.id}`)
                        }
                        className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <td className="px-4 py-4 whitespace-nowrap overflow-hidden">
                          <div className="flex items-center gap-3 min-w-0">
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
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right font-medium overflow-hidden">
                          <div
                            className={`truncate ${transaction.type === "expense" ? "text-red-600" : "text-green-600"}`}
                          >
                            {transaction.type === "expense" ? "-" : "+"}
                            {transaction.eur_amount && transaction.currency !== 'EUR' ? (
                              <span>
                                {formatCurrency(transaction.eur_amount, 'EUR')}
                                <span className="text-xs text-muted-foreground ml-1">
                                  ({formatCurrency(transaction.amount, transaction.currency)})
                                </span>
                              </span>
                            ) : (
                              formatCurrency(transaction.amount, transaction.currency)
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                )
              )}
            </tbody>
          </table>
        </div>

        <div className="block md:hidden">
          {Object.entries(groupedTransactions).map(
            ([date, dateTransactions]) => (
              <div key={date} className="mb-4">
                <h3 className="px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-t-lg">
                  {date}
                </h3>
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
                                {transaction.type === "expense" ? "-" : "+"}
                                {transaction.eur_amount && transaction.currency !== 'EUR' ? (
                                  <div className="flex flex-col">
                                    <span>{formatCurrency(transaction.eur_amount, 'EUR')}</span>
                                    <span className="text-xs text-muted-foreground">
                                      ({formatCurrency(transaction.amount, transaction.currency)})
                                    </span>
                                  </div>
                                ) : (
                                  formatCurrency(transaction.amount, transaction.currency)
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
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}

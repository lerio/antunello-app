import React from "react";
import { useRouter } from "next/navigation";
import { Transaction } from "@/types/database";
import { formatDate } from "@/utils/date";
import { formatCurrency } from "@/utils/currency";
import { LucideProps } from "lucide-react";
import { CATEGORY_ICONS } from "@/utils/categories";
import NoTransactions from "@/components/features/no-transactions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '50%' }}>
                  Transaction
                </th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '20%' }}>
                  Type
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '30%' }}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {Object.entries(groupedTransactions).map(([date, dateTransactions]) => (
                <React.Fragment key={date}>
                  <tr className="bg-gray-50 dark:bg-gray-800/50">
                    <td colSpan={3} className="px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                      {date}
                    </td>
                  </tr>
                  {dateTransactions.map((transaction) => (
                    <tr
                      key={transaction.id}
                      onClick={() => router.push(`/protected/edit/${transaction.id}`)}
                      className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <td className="px-4 py-4 whitespace-nowrap overflow-hidden">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                            {React.createElement(CATEGORY_ICONS[transaction.main_category] || CATEGORY_ICONS["Services"], { size: 16 } as LucideProps)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{transaction.title}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{transaction.sub_category}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <Badge variant={transaction.type === "expense" ? "destructive" : "default"} className="capitalize text-xs">
                          {transaction.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right font-medium overflow-hidden">
                        <div className={`truncate ${transaction.type === "expense" ? "text-red-600" : "text-green-600"}`}>
                          {transaction.type === "expense" ? "-" : "+"}
                          {formatCurrency(transaction.amount, transaction.currency)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div className="block md:hidden">
          {Object.entries(groupedTransactions).map(([date, dateTransactions]) => (
            <div key={date} className="mb-4">
              <h3 className="px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-t-lg">
                {date}
              </h3>
              <ul className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900 rounded-b-lg">
                {dateTransactions.map((transaction) => (
                  <li
                    key={transaction.id}
                    onClick={() => router.push(`/protected/edit/${transaction.id}`)}
                    className="px-4 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center justify-between min-w-0">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                          {React.createElement(CATEGORY_ICONS[transaction.main_category] || CATEGORY_ICONS["Services"], { size: 16 } as LucideProps)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{transaction.title}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{transaction.sub_category}</div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4 min-w-0">
                        <div className={`font-medium text-sm truncate ${transaction.type === "expense" ? "text-red-600" : "text-green-600"}`}>
                          {transaction.type === "expense" ? "-" : "+"}
                          {formatCurrency(transaction.amount, transaction.currency)}
                        </div>
                        <Badge variant={transaction.type === "expense" ? "destructive" : "default"} className="capitalize mt-1 text-xs">
                          {transaction.type}
                        </Badge>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

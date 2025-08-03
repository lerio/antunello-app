import React, { useMemo } from "react"
import { useRouter } from "next/navigation"
import { Transaction } from "@/types/database"
import { formatDate } from "@/utils/date"
import { formatCurrency } from "@/utils/currency"
import { CATEGORY_ICONS } from "@/utils/categories"
import NoTransactions from "@/components/features/no-transactions"
import { Card, CardContent } from "@/components/ui/card"

type TransactionsTableProps = {
  transactions: Transaction[]
  onTransactionClick?: (transaction: Transaction) => void
}

// Optimized transaction row component
const TransactionRow = React.memo(({ transaction, onClick }: { 
  transaction: Transaction
  onClick: (transaction: Transaction) => void 
}) => {
  const Icon = CATEGORY_ICONS[transaction.main_category] || CATEGORY_ICONS["Services"]
  const amount = transaction.eur_amount || transaction.amount
  const showOriginalCurrency = transaction.eur_amount && transaction.currency !== "EUR"

  return (
    <div
      onClick={() => onClick(transaction)}
      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors px-4 py-3 flex items-center justify-between"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
          <Icon {...({ size: 16 } as any)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm">
            {transaction.title}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {transaction.sub_category}
          </div>
        </div>
      </div>
      
      <div className="text-right font-medium ml-4 flex-shrink-0">
        <div className={`text-sm ${
          transaction.type === "expense" ? "text-red-600" : "text-green-600"
        }`}>
          {showOriginalCurrency && (
            <div className="text-xs text-gray-500 mb-0.5">
              ({formatCurrency(transaction.amount, transaction.currency)})
            </div>
          )}
          {formatCurrency(amount, showOriginalCurrency ? "EUR" : transaction.currency)}
        </div>
      </div>
    </div>
  )
})

TransactionRow.displayName = "TransactionRow"

// Optimized date group component with sticky headers
const DateGroup = React.memo(({ 
  date, 
  transactions, 
  dailyTotal, 
  onTransactionClick 
}: {
  date: string
  transactions: Transaction[]
  dailyTotal: number
  onTransactionClick: (transaction: Transaction) => void
}) => (
  <div className="mb-2">
    {/* Sticky Date Header */}
    <div className="px-4 py-3 text-sm font-medium flex justify-between items-center sticky-date-header">
      <span className="text-gray-500 dark:text-gray-400 font-medium">
        {date}
      </span>
      <span className={`font-semibold ${
        dailyTotal >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
      }`}>
        {formatCurrency(Math.abs(dailyTotal), "EUR")}
      </span>
    </div>
    
    {/* Transactions Card */}
    <Card className="rounded-none border-t-0">
      <CardContent className="divide-y divide-gray-200 dark:divide-gray-700 p-0">
        {transactions.map((transaction) => (
          <TransactionRow
            key={transaction.id}
            transaction={transaction}
            onClick={onTransactionClick}
          />
        ))}
      </CardContent>
    </Card>
  </div>
))

DateGroup.displayName = "DateGroup"

export default function TransactionsTable({ transactions, onTransactionClick }: TransactionsTableProps) {
  const groupedData = useMemo(() => {
    if (!transactions.length) return {}

    return transactions.reduce((groups, transaction) => {
      const date = formatDate(transaction.date)
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(transaction)
      return groups
    }, {} as Record<string, Transaction[]>)
  }, [transactions])

  const handleTransactionClick = React.useCallback((transaction: Transaction) => {
    if (onTransactionClick) {
      onTransactionClick(transaction)
    }
  }, [onTransactionClick])

  if (transactions.length === 0) {
    return <NoTransactions />
  }

  return (
    <div className="w-full" style={{ overflow: 'visible' }}>
      {Object.entries(groupedData).map(([date, dateTransactions]) => {
        const dailyTotal = dateTransactions.reduce((total, t) => {
          const amount = t.eur_amount || (t.currency === "EUR" ? t.amount : 0)
          return total + (t.type === "expense" ? -amount : amount)
        }, 0)

        return (
          <DateGroup
            key={date}
            date={date}
            transactions={dateTransactions}
            dailyTotal={dailyTotal}
            onTransactionClick={handleTransactionClick}
          />
        )
      })}
    </div>
  )
}
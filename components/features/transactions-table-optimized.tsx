import React, { useMemo } from "react"
import { useRouter } from "next/navigation"
import { Transaction } from "@/types/database"
import { formatDate, formatDateHeader } from "@/utils/date"
import { formatCurrency } from "@/utils/currency"
import { CATEGORY_ICONS } from "@/utils/categories"
import NoTransactions from "@/components/features/no-transactions"
import { LucideProps } from "lucide-react"

type TransactionsTableProps = {
  transactions: Transaction[]
  onTransactionClick?: (transaction: Transaction) => void
}

// Optimized transaction row component with new card design
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
      className="bg-white dark:bg-gray-800 rounded-lg p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-center">
        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          <Icon {...({ size: 20, className: "text-gray-500 dark:text-gray-400" } as LucideProps)} />
        </div>
        <div className="ml-4">
          <p className="font-medium text-gray-800 dark:text-gray-200">{transaction.title}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{transaction.sub_category}</p>
        </div>
      </div>
      <div>
        <p className={`font-medium text-right ${
          transaction.type === "expense" ? "text-red-500" : "text-green-500"
        }`}>
          {formatCurrency(amount, showOriginalCurrency ? "EUR" : transaction.currency)}
        </p>
        {showOriginalCurrency && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-right">
            ({formatCurrency(transaction.amount, transaction.currency)})
          </p>
        )}
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
  <div className="mb-6">
    {/* Sticky Date Header */}
    <div className="sticky top-28 bg-gray-50 dark:bg-gray-900 z-40 py-3 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
      <h3 className="font-semibold text-gray-600 dark:text-gray-400">{formatDateHeader(transactions[0].date)}</h3>
      <span className={`font-semibold ${
        dailyTotal >= 0 ? "text-green-500" : "text-red-500"
      }`}>
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
    <div className="space-y-6">
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
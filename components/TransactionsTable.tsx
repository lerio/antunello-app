'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Transaction } from '@/types/database'
import { formatDate } from '@/utils/date'
import { formatCurrency } from '@/utils/currency'
import { LucideProps } from 'lucide-react'
import { CATEGORY_ICONS } from '@/utils/categories'
import NoTransactions from './NoTransactions'

type TransactionsTableProps = {
  initialTransactions: Transaction[]
}

type GroupedTransactions = {
  [date: string]: Transaction[]
}

export default function TransactionsTable({ initialTransactions }: TransactionsTableProps) {
  const [transactions, setTransactions] = useState(initialTransactions)
  const router = useRouter()

  useEffect(() => {
    setTransactions(initialTransactions)
  }, [initialTransactions])

  if (transactions.length === 0) {
    return <NoTransactions />
  }

  // Group transactions by date
  const groupedTransactions = transactions.reduce((groups: GroupedTransactions, transaction) => {
    const date = formatDate(transaction.date)
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(transaction)
    return groups
  }, {})

  // Sort transactions within each group by date (most recent first)
  Object.keys(groupedTransactions).forEach(date => {
    groupedTransactions[date].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  })

  // Sort the dates themselves (most recent first)
  const sortedDates = Object.keys(groupedTransactions).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  )

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {sortedDates.map(date => (
            <React.Fragment key={date}>
              <tr className="bg-gray-50 dark:bg-gray-800">
                <td 
                  colSpan={4} 
                  className="px-6 py-2 text-sm font-medium text-gray-900 dark:text-gray-100"
                >
                  {date}
                </td>
              </tr>
              {groupedTransactions[date].map((transaction) => (
                <tr 
                  key={transaction.id}
                  onClick={() => router.push(`/protected/edit/${transaction.id}`)}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                <td className="px-6 py-4 text-gray-500 dark:text-gray-400" title={transaction.main_category}>
                    {React.createElement(CATEGORY_ICONS[transaction.main_category] || CATEGORY_ICONS['Services'], {
                      size: 18
                    } as LucideProps)}
                  </td>
                <td className="px-6 py-4 text-gray-900 dark:text-gray-300 capitalize">
                  <div className="flex flex-col">
                    <span>
                        {transaction.title.toLowerCase()}
                      </span>
                      {transaction.sub_category && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {transaction.sub_category}
                        </span>
                      )}
                    </div>
                  </td>
                <td className="px-6 py-4">
                    <span className={transaction.type === 'expense' ? 'text-red-600' : 'text-green-600'}>
                      {transaction.type === 'expense' ? '-' : '+'}
                      {formatCurrency(transaction.amount, transaction.currency)}
                    </span>
                  </td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
} 
'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Transaction } from '@/types/database'
import { createClient } from '@/utils/supabase/client'
import { formatDate, formatDateTimeTooltip } from '@/utils/date'
import { formatCurrency } from '@/utils/currency'
import { Pencil, Trash2, LucideProps } from 'lucide-react'
import { CATEGORY_ICONS } from '@/utils/categories'

type TransactionsTableProps = {
  initialTransactions: Transaction[]
  onDelete?: () => void
}

type GroupedTransactions = {
  [date: string]: Transaction[]
}

export default function TransactionsTable({ initialTransactions, onDelete }: TransactionsTableProps) {
  const [transactions, setTransactions] = useState(initialTransactions)
  const router = useRouter()

  useEffect(() => {
    setTransactions(initialTransactions)
  }, [initialTransactions])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return
    
    const supabase = createClient()
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)

    if (!error) {
      setTransactions(transactions.filter(t => t.id !== id))
      onDelete?.()
    }
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

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-12">Category</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Title</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {Object.entries(groupedTransactions).map(([date, dateTransactions]) => (
            <React.Fragment key={date}>
              <tr className="bg-gray-50 dark:bg-gray-800">
                <td 
                  colSpan={4} 
                  className="px-6 py-2 text-sm font-medium text-gray-900 dark:text-gray-100"
                >
                  {date}
                </td>
              </tr>
              {dateTransactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                    {React.createElement(CATEGORY_ICONS[transaction.main_category] || CATEGORY_ICONS['Services'], {
                      size: 18,
                      className: "cursor-help",
                      title: transaction.main_category
                    } as LucideProps)}
                  </td>
                  <td className="px-6 py-4 text-gray-900 dark:text-gray-300 capitalize">
                    <div className="flex flex-col">
                      <span 
                        className="cursor-help"
                        title={formatDateTimeTooltip(transaction.date)}
                      >
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
                  <td className="px-6 py-4 space-x-2">
                    <button
                      onClick={() => router.push(`/protected/edit/${transaction.id}`)}
                      className="p-1 text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                      title="Edit transaction"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(transaction.id)}
                      className="p-1 text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      title="Delete transaction"
                    >
                      <Trash2 size={16} />
                    </button>
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
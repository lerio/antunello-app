'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Transaction } from '@/types/database'
import { createClient } from '@/utils/supabase/client'
import { formatDateTime } from '@/utils/date'

type TransactionsTableProps = {
  initialTransactions: Transaction[]
  onDelete?: () => void
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

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Title</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-gray-300">
                {formatDateTime(transaction.date)}
              </td>
              <td className="px-6 py-4 text-gray-900 dark:text-gray-300">{transaction.title}</td>
              <td className="px-6 py-4">
                <span className={transaction.type === 'expense' ? 'text-red-600' : 'text-green-600'}>
                  {transaction.type === 'expense' ? '-' : '+'}
                  {transaction.amount} {transaction.currency}
                </span>
              </td>
              <td className="px-6 py-4 text-gray-900 dark:text-gray-300">
                {transaction.main_category}
                {transaction.sub_category && ` / ${transaction.sub_category}`}
              </td>
              <td className="px-6 py-4 space-x-2">
                <button
                  onClick={() => router.push(`/protected/edit/${transaction.id}`)}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(transaction.id)}
                  className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
} 
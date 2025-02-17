'use client'

import { useState, useEffect } from 'react'
import { Transaction } from '@/types/database'
import { createClient } from '@/utils/supabase/client'

type TransactionsTableProps = {
  initialTransactions: Transaction[]
  onEdit: (transaction: Transaction) => void
}

export default function TransactionsTable({ initialTransactions, onEdit }: TransactionsTableProps) {
  const [transactions, setTransactions] = useState(initialTransactions)

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
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td className="px-6 py-4 whitespace-nowrap">
                {new Date(transaction.date).toLocaleDateString()}
              </td>
              <td className="px-6 py-4">{transaction.title}</td>
              <td className="px-6 py-4">
                <span className={transaction.type === 'expense' ? 'text-red-600' : 'text-green-600'}>
                  {transaction.type === 'expense' ? '-' : '+'}
                  {transaction.amount} {transaction.currency}
                </span>
              </td>
              <td className="px-6 py-4">
                {transaction.main_category}
                {transaction.sub_category && ` / ${transaction.sub_category}`}
              </td>
              <td className="px-6 py-4 space-x-2">
                <button
                  onClick={() => onEdit(transaction)}
                  className="text-blue-600 hover:text-blue-900"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(transaction.id)}
                  className="text-red-600 hover:text-red-900"
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
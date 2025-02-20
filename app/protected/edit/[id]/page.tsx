'use client'

import { useRouter } from 'next/navigation'
import { use } from 'react'
import TransactionForm from '@/components/TransactionForm'
import { Transaction } from '@/types/database'
import { ArrowLeft } from 'lucide-react'
import { useTransactionMutations } from '@/hooks/useTransactionMutations'
import { useTransaction } from '@/hooks/useTransaction'

export default function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const resolvedParams = use(params)
  const { updateTransaction, deleteTransaction } = useTransactionMutations()
  const { transaction, isLoading, error } = useTransaction(resolvedParams.id)

  if (error) {
    router.push('/protected')
    return null
  }

  const handleSubmit = async (data: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => {
    if (!transaction) return
    try {
      await updateTransaction(transaction.id, data, transaction.date)
      router.push('/protected?success=updated')
    } catch (error) {
      console.error('Failed to update transaction:', error)
      // You might want to show an error notification here
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) return
    if (!transaction) return

    try {
      await deleteTransaction(transaction)
      router.push('/protected?success=deleted')
    } catch (error) {
      console.error('Failed to delete transaction:', error)
      // You might want to show an error notification here
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p>Loading...</p>
      </div>
    )
  }

  if (!transaction) return null

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button 
        onClick={() => router.push('/protected')}
        className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-6"
      >
        <ArrowLeft size={20} className="mr-1" />
        Back
      </button>
      
      <h1 className="text-2xl font-bold mb-6">Edit Transaction</h1>
      <TransactionForm 
        initialData={transaction}
        onSubmit={handleSubmit}
      />
      <div className="mt-2 pt-2">
        <button
          onClick={handleDelete}
          className="w-full bg-red-600 text-white p-2 rounded hover:bg-red-700"
        >
          Delete Transaction
        </button>
      </div>
    </div>
  )
} 
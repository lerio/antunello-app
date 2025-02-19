'use client'

import { useRouter } from 'next/navigation'
import TransactionForm from '@/components/TransactionForm'
import { ArrowLeft } from 'lucide-react'
import { addToCachedTransactions } from '@/utils/transactionsCache'
import { Transaction } from '@/types/database'

export default function AddTransactionPage() {
  const router = useRouter()

  const handleSuccess = (transaction: Transaction) => {
    addToCachedTransactions(transaction)
    router.push('/protected?success=added')
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button 
        onClick={() => router.push('/protected')}
        className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-6"
      >
        <ArrowLeft size={20} className="mr-1" />
        Back
      </button>

      <h1 className="text-2xl font-bold mb-6">Add New Transaction</h1>
      <TransactionForm onSuccess={handleSuccess} />
    </div>
  )
} 
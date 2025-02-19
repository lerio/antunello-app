'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, use } from 'react'
import TransactionForm from '@/components/TransactionForm'
import { Transaction } from '@/types/database'
import { createClient } from '@/utils/supabase/client'
import { ArrowLeft } from 'lucide-react'
import { updateCachedTransaction, deleteFromCachedTransactions, getCachedTransactions } from '@/utils/transactionsCache'

export default function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const resolvedParams = use(params)

  useEffect(() => {
    const fetchTransaction = async () => {
      // Try to find transaction in cache first
      const allMonths = Object.keys(localStorage)
        .filter(key => key.startsWith('transactions_'))
        .map(key => getCachedTransactions(key.replace('transactions_', '')))
        .filter((cached): cached is Transaction[] => cached !== null)
        .flat()
      
      const cachedTransaction = allMonths.find(t => t.id === resolvedParams.id)
      
      if (cachedTransaction) {
        setTransaction(cachedTransaction)
        setIsLoading(false)
        return
      }

      // Fallback to DB if not found in cache
      const supabase = createClient()
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', resolvedParams.id)
        .single()

      if (data) {
        setTransaction(data)
      } else {
        // If transaction not found, redirect to main page
        router.push('/protected')
      }
      setIsLoading(false)
    }

    fetchTransaction()
  }, [resolvedParams.id, router])

  const handleSuccess = (transaction: Transaction) => {
    updateCachedTransaction(transaction)
    router.push('/protected?success=updated')
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) return
    
    if (!transaction) return
    
    const supabase = createClient()
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', resolvedParams.id)

    if (!error) {
      deleteFromCachedTransactions(transaction)
      router.push('/protected?success=deleted')
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
        onSuccess={handleSuccess}
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
'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, use } from 'react'
import TransactionForm from '@/components/TransactionForm'
import { Transaction } from '@/types/database'
import { createClient } from '@/utils/supabase/client'

export default function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const resolvedParams = use(params)

  useEffect(() => {
    const fetchTransaction = async () => {
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

  const handleSuccess = () => {
    router.push('/protected?success=updated')
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
      <h1 className="text-2xl font-bold mb-6">Edit Transaction</h1>
      <TransactionForm 
        initialData={transaction}
        onSuccess={handleSuccess}
      />
    </div>
  )
} 
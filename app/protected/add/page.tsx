'use client'

import { useRouter } from 'next/navigation'
import TransactionForm from '@/components/TransactionForm'

export default function AddTransactionPage() {
  const router = useRouter()

  const handleSuccess = () => {
    router.push('/protected?success=added')
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Add New Transaction</h1>
      <TransactionForm onSuccess={handleSuccess} />
    </div>
  )
} 
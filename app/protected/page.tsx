'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { PlusIcon } from 'lucide-react'
import TransactionsTable from '@/components/TransactionsTable'
import Notification from '@/components/Notification'
import { Transaction } from '@/types/database'
import { supabase } from '@/utils/supabase'

export default function ProtectedPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [showNotification, setShowNotification] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState('')
  const searchParams = useSearchParams()

  const fetchTransactions = async () => {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })

    if (data) {
      setTransactions(data)
    }
  }

  useEffect(() => {
    fetchTransactions()
  }, [])

  useEffect(() => {
    const successType = searchParams.get('success')
    if (successType === 'added') {
      setNotificationMessage('Transaction added successfully!')
      setShowNotification(true)
    } else if (successType === 'updated') {
      setNotificationMessage('Transaction updated successfully!')
      setShowNotification(true)
    }
  }, [searchParams])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <Link
          href="/protected/add"
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          <PlusIcon size={16} />
          Add Transaction
        </Link>
      </div>
      
      <Suspense fallback={<div>Loading transactions...</div>}>
        <TransactionsTable 
          initialTransactions={transactions}
        />
      </Suspense>

      {showNotification && (
        <Suspense fallback={null}>
          <Notification
            message={notificationMessage}
            onClose={() => setShowNotification(false)}
          />
        </Suspense>
      )}
    </div>
  )
}

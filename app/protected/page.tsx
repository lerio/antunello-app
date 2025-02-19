'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { PlusIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import TransactionsTable from '@/components/TransactionsTable'
import Notification from '@/components/Notification'
import { Transaction } from '@/types/database'
import { supabase } from '@/utils/supabase'
import { getCachedTransactions, setCachedTransactions } from '@/utils/transactionsCache'

export default function ProtectedPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [showNotification, setShowNotification] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())
  const searchParams = useSearchParams()

  const fetchTransactions = async () => {
    // Format: YYYY-MM
    const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`

    // Try to get from cache first
    const cached = getCachedTransactions(monthKey)
    if (cached) {
      setTransactions(cached)
      return
    }

    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59)

    const { data } = await supabase
      .from('transactions')
      .select('*')
      .gte('date', startOfMonth.toISOString())
      .lte('date', endOfMonth.toISOString())
      .order('date', { ascending: false })

    if (data) {
      setTransactions(data)
      // Store in cache
      setCachedTransactions(monthKey, data)
    }
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate)
      if (direction === 'prev') {
        newDate.setMonth(prevDate.getMonth() - 1)
      } else {
        newDate.setMonth(prevDate.getMonth() + 1)
      }
      return newDate
    })
  }

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    })
  }

  useEffect(() => {
    fetchTransactions()
  }, [currentDate])

  useEffect(() => {
    const successType = searchParams.get('success')
    if (successType === 'added') {
      setNotificationMessage('Transaction added successfully!')
      setShowNotification(true)
    } else if (successType === 'updated') {
      setNotificationMessage('Transaction updated successfully!')
      setShowNotification(true)
    } else if (successType === 'deleted') {
      setNotificationMessage('Transaction deleted successfully!')
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
      
      <div className="flex justify-center items-center gap-4 mb-8">
        <button
          onClick={() => navigateMonth('prev')}
          className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
        >
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-xl font-medium capitalize">
          {formatMonthYear(currentDate)}
        </h2>
        <button
          onClick={() => navigateMonth('next')}
          className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
        >
          <ChevronRight size={24} />
        </button>
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

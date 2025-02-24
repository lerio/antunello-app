'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlusIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import TransactionsTable from '@/components/TransactionsTable'
import MonthSummary from '@/components/MonthSummary'
import { useTransactions } from '@/hooks/useTransactions'
import { Button } from '@/components/ui/button'

export default function ProtectedPage() {
  const router = useRouter()
  const [isNavigating, setIsNavigating] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())

  const { transactions, isLoading } = useTransactions(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1
  )

  // Prefetch the add transaction page
  useEffect(() => {
    router.prefetch('/protected/add')
  }, [router])

  const handleAddTransaction = () => {
    setIsNavigating(true)
    router.push('/protected/add')
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <Button
          onClick={handleAddTransaction}
          disabled={isNavigating}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 cursor-pointer min-w-[160px] justify-center"
        >
          <PlusIcon size={16} />
          {isNavigating ? 'Loading...' : 'Add Transaction'}
        </Button>
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
      
      <MonthSummary transactions={transactions} />
      
      {isLoading ? (
        <div>Loading transactions...</div>
      ) : (
        <TransactionsTable 
          transactions={transactions}
        />
      )}
    </div>
  )
}

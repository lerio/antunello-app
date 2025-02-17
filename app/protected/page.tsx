'use client'

import { useEffect, useState } from 'react'
import TransactionForm from '@/components/TransactionForm'
import TransactionsTable from '@/components/TransactionsTable'
import { Transaction } from '@/types/database'
import { supabase } from '@/utils/supabase'

export default function ProtectedPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  
  const fetchTransactions = async () => {
    const { data, error } = await supabase
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-4">Add New Transaction</h1>
        <TransactionForm onSuccess={fetchTransactions} />
      </div>
      
      <div>
        <h2 className="text-2xl font-bold mb-4">Recent Transactions</h2>
        <TransactionsTable 
          initialTransactions={transactions}
          onEdit={(transaction) => {
            console.log('Edit transaction:', transaction)
          }}
        />
      </div>
    </div>
  )
}

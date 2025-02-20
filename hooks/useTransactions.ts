import useSWR from 'swr'
import { useEffect } from 'react'
import { supabase } from '@/utils/supabase'
import { Transaction } from '@/types/database'
import { RealtimeChannel } from '@supabase/supabase-js'

// Fetch transactions for a specific month
const fetchTransactions = async (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59)

  const { data } = await supabase
    .from('transactions')
    .select('*')
    .gte('date', start.toISOString())
    .lte('date', end.toISOString())
    .order('date', { ascending: false })

  return data || []
}

export function useTransactions(year: number, month: number) {
  const monthKey = `transactions-${year}-${String(month).padStart(2, '0')}`
  
  const { data: transactions, mutate } = useSWR<Transaction[]>(
    monthKey,
    () => fetchTransactions(`${year}-${month}`),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false
    }
  )

  useEffect(() => {
    let channel: RealtimeChannel

    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      channel = supabase
        .channel('transactions')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${user.id}`
        }, (payload) => {
          // Handle different real-time events
          switch (payload.eventType) {
            case 'INSERT':
              handleInsert(payload.new as Transaction)
              break
            case 'UPDATE':
              handleUpdate(payload.old as Transaction, payload.new as Transaction)
              break
            case 'DELETE':
              handleDelete(payload.old as Transaction)
              break
          }
        })
        .subscribe()
    }

    setupSubscription()
    
    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [mutate])

  const handleInsert = (newTransaction: Transaction) => {
    const transactionMonth = new Date(newTransaction.date).getMonth() + 1
    const transactionYear = new Date(newTransaction.date).getFullYear()
    
    if (transactionMonth === month && transactionYear === year) {
      mutate((current) => 
        current ? [...current, newTransaction] : [newTransaction]
      )
    }
  }

  const handleUpdate = (oldTransaction: Transaction, newTransaction: Transaction) => {
    const oldMonth = new Date(oldTransaction.date).getMonth() + 1
    const oldYear = new Date(oldTransaction.date).getFullYear()
    const newMonth = new Date(newTransaction.date).getMonth() + 1
    const newYear = new Date(newTransaction.date).getFullYear()

    if (oldMonth === month && oldYear === year) {
      if (newMonth === month && newYear === year) {
        // Update within the same month
        mutate((current) => 
          current?.map(t => t.id === newTransaction.id ? newTransaction : t)
        )
      } else {
        // Remove from current month
        mutate((current) => 
          current?.filter(t => t.id !== oldTransaction.id)
        )
      }
    } else if (newMonth === month && newYear === year) {
      // Add to new month
      mutate((current) => 
        current ? [...current, newTransaction] : [newTransaction]
      )
    }
  }

  const handleDelete = (oldTransaction: Transaction) => {
    const transactionMonth = new Date(oldTransaction.date).getMonth() + 1
    const transactionYear = new Date(oldTransaction.date).getFullYear()
    
    if (transactionMonth === month && transactionYear === year) {
      mutate((current) => 
        current?.filter(t => t.id !== oldTransaction.id)
      )
    }
  }

  return {
    transactions: transactions || [],
    isLoading: !transactions,
    mutate
  }
} 
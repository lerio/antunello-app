import { useSWRConfig } from 'swr'
import { createClient } from '@/utils/supabase/client'
import { Transaction } from '@/types/database'

export function useTransactionMutations() {
  const { mutate } = useSWRConfig()
  const supabase = createClient()

  const getMonthKey = (date: string) => {
    const d = new Date(date)
    return `transactions-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  const getTransactionKey = (id: string) => `transaction-${id}`

  const addTransaction = async (data: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => {
    const { data: newTransaction, error } = await supabase
      .from('transactions')
      .insert([data])
      .select()
      .single()

    if (error) throw error
    
    // Optimistically update the cache
    const monthKey = getMonthKey(data.date)
    mutate(monthKey, (transactions: Transaction[] = []) => {
      return [...transactions, newTransaction]
    }, false) // Don't revalidate immediately

    return newTransaction
  }

  const updateTransaction = async (id: string, data: Partial<Transaction>, oldDate: string) => {
    const { data: updatedTransaction, error } = await supabase
      .from('transactions')
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Handle month change
    const oldMonthKey = getMonthKey(oldDate)
    const newMonthKey = getMonthKey(data.date || oldDate)

    if (oldMonthKey !== newMonthKey) {
      // Remove from old month
      mutate(oldMonthKey, (transactions: Transaction[] = []) => {
        return transactions.filter(t => t.id !== id)
      }, false)

      // Add to new month
      mutate(newMonthKey, (transactions: Transaction[] = []) => {
        return [...transactions, updatedTransaction]
      }, false)
    } else {
      // Update in current month
      mutate(oldMonthKey, (transactions: Transaction[] = []) => {
        return transactions.map(t => t.id === id ? updatedTransaction : t)
      }, false)
    }

    // Update the single transaction cache
    mutate(getTransactionKey(id), updatedTransaction, false)

    return updatedTransaction
  }

  const deleteTransaction = async (transaction: Transaction) => {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', transaction.id)

    if (error) throw error

    // Remove from cache
    const monthKey = getMonthKey(transaction.date)
    mutate(monthKey, (transactions: Transaction[] = []) => {
      return transactions.filter(t => t.id !== transaction.id)
    }, false)

    // Remove from single transaction cache
    mutate(getTransactionKey(transaction.id), null, false)
  }

  return {
    addTransaction,
    updateTransaction,
    deleteTransaction
  }
} 
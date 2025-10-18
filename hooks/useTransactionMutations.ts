import { useSWRConfig } from 'swr'
import { createClient } from '@/utils/supabase/client'
import { Transaction } from '@/types/database'
import { convertToEUR } from '@/utils/currency-conversion'
import { transactionCache } from '@/utils/simple-cache'
import { createYearKey } from '@/utils/year-fetcher'

export function useTransactionMutations() {
  const { mutate } = useSWRConfig()
  const supabase = createClient()

  const getMonthKey = (date: string) => {
    const d = new Date(date)
    return `transactions-${d.getFullYear()}-${d.getMonth() + 1}`
  }

  const getYearKey = (date: string) => {
    const d = new Date(date)
    return createYearKey(d.getFullYear())
  }

  const getTransactionKey = (id: string) => `transaction-${id}`

  // Helper function to update both SWR cache and simple cache (both month and year)
  const updateBothCaches = (monthKey: string, updateFn: (transactions: Transaction[]) => Transaction[]) => {
    // Update SWR cache - handle undefined case
    mutate(monthKey, (currentData: Transaction[] = []) => updateFn(currentData), false)

    // Update simple cache
    const cachedData = transactionCache.get(monthKey)
    if (cachedData) {
      const updatedData = updateFn(cachedData)
      transactionCache.set(monthKey, updatedData)
    }
  }

  // Helper function to invalidate year cache when transactions change
  const invalidateYearCache = (date: string) => {
    const yearKey = getYearKey(date)
    // Remove from SWR cache to force refetch
    mutate(yearKey, undefined, true)
    // Remove from simple cache
    transactionCache.delete(yearKey)
  }

  // Helper to convert currency to EUR
  const convertAndUpdateCurrency = async (amount: number, currency: string, date: string): Promise<Partial<Transaction>> => {
    if (currency === 'EUR') {
      return { eur_amount: amount, exchange_rate: 1.0, rate_date: date.split('T')[0] }
    }
    const conversionResult = await convertToEUR(amount, currency, date.split('T')[0])
    if (conversionResult) {
      return {
        eur_amount: conversionResult.eurAmount,
        exchange_rate: conversionResult.exchangeRate,
        rate_date: conversionResult.rateDate
      }
    }
    return {}
  }

  // Helper to sort transactions by date descending
  const sortTransactionsByDate = (transactions: Transaction[]): Transaction[] => {
    return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  const addTransaction = async (data: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => {
    const monthKey = getMonthKey(data.date)

    // Calculate optimistic EUR amount
    const optimisticEurAmount = data.eur_amount || (data.currency === 'EUR' ? data.amount : undefined)

    // Create optimistic transaction with temporary ID
    const optimisticTransaction: Transaction = {
      ...data,
      id: `temp-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      eur_amount: optimisticEurAmount,
    }

    // Optimistically update the cache immediately
    updateBothCaches(monthKey, (transactions: Transaction[] = []) => {
      return sortTransactionsByDate([optimisticTransaction, ...transactions])
    })

    try {
      // Prepare transaction data with currency conversion
      const transactionData = {
        ...data,
        ...(!data.eur_amount ? await convertAndUpdateCurrency(data.amount, data.currency, data.date) : {})
      }

      const { data: newTransaction, error } = await supabase
        .from('transactions')
        .insert([transactionData])
        .select()
        .single()

      if (error) throw error

      // Replace optimistic transaction with real one
      updateBothCaches(monthKey, (transactions: Transaction[] = []) => {
        return sortTransactionsByDate(
          transactions.map(t => t.id === optimisticTransaction.id ? newTransaction : t)
        )
      })

      // Invalidate year cache to ensure yearly summary is updated
      invalidateYearCache(data.date)
      // Revalidate overall totals
      mutate('/api/overall-totals', undefined, true)

      return newTransaction
    } catch (error) {
      // Rollback optimistic update on error
      updateBothCaches(monthKey, (transactions: Transaction[] = []) => {
        return transactions.filter(t => t.id !== optimisticTransaction.id)
      })
      throw error
    }
  }

  // Helper to calculate optimistic EUR amount for updates
  const calculateOptimisticEurAmount = async (transaction: Transaction, updates: Partial<Transaction>): Promise<number | undefined> => {
    const newCurrency = updates.currency || transaction.currency
    const newAmount = updates.amount !== undefined ? updates.amount : transaction.amount
    const newDate = updates.date || transaction.date

    if (newCurrency === 'EUR') {
      return newAmount
    }

    if (!['amount', 'currency', 'date'].some(key => key in updates)) {
      // No relevant changes, keep existing EUR amount
      return updates.eur_amount !== undefined ? updates.eur_amount : transaction.eur_amount
    }

    try {
      const conversionResult = await convertToEUR(newAmount, newCurrency, newDate.split('T')[0])
      return conversionResult?.eurAmount
    } catch {
      return undefined
    }
  }

  const updateTransaction = async (id: string, data: Partial<Transaction>, oldDate: string) => {
    const oldMonthKey = getMonthKey(oldDate)
    const newMonthKey = getMonthKey(data.date || oldDate)
    let originalTransaction: Transaction | undefined

    // Get original transaction from cache
    updateBothCaches(oldMonthKey, (transactions: Transaction[] = []) => {
      originalTransaction = transactions.find(t => t.id === id)
      return transactions
    })

    if (!originalTransaction) return

    // Calculate optimistic EUR amount
    const optimisticEurAmount = await calculateOptimisticEurAmount(originalTransaction, data)
    const updatedTransaction = {
      ...originalTransaction,
      ...data,
      updated_at: new Date().toISOString(),
      ...(optimisticEurAmount !== undefined && { eur_amount: optimisticEurAmount }),
    }

    // Handle month changes
    if (oldMonthKey !== newMonthKey) {
      updateBothCaches(oldMonthKey, (transactions: Transaction[] = []) => {
        return transactions.filter(t => t.id !== id)
      })
      updateBothCaches(newMonthKey, (transactions: Transaction[] = []) => {
        return sortTransactionsByDate([updatedTransaction, ...transactions])
      })
    } else {
      updateBothCaches(oldMonthKey, (transactions: Transaction[] = []) => {
        return sortTransactionsByDate(
          transactions.map(t => (t.id === id ? updatedTransaction : t))
        )
      })
    }

    try {
      // Prepare update data with currency conversion if needed
      const updateData = {
        ...data,
        ...(!data.eur_amount && (data.amount !== undefined || data.currency !== undefined || data.date !== undefined)
          ? await convertAndUpdateCurrency(
              data.amount !== undefined ? data.amount : originalTransaction.amount,
              data.currency || originalTransaction.currency,
              data.date || originalTransaction.date
            )
          : {})
      }

      const { data: updatedTransaction, error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      // Update cache with real data
      const targetMonthKey = oldMonthKey === newMonthKey ? oldMonthKey : newMonthKey
      updateBothCaches(targetMonthKey, (transactions: Transaction[] = []) => {
        return sortTransactionsByDate(
          transactions.map(t => (t.id === id ? updatedTransaction : t))
        )
      })

      // Update the single transaction cache
      mutate(getTransactionKey(id), updatedTransaction, false)

      // Invalidate year caches to ensure yearly summaries are updated
      invalidateYearCache(oldDate)
      if (data.date && data.date !== oldDate) {
        invalidateYearCache(data.date)
      }
      // Revalidate overall totals
      mutate('/api/overall-totals', undefined, true)

      return updatedTransaction
    } catch (error) {
      // Rollback optimistic update on error
      if (!originalTransaction) throw error

      if (oldMonthKey !== newMonthKey) {
        // Restore to old month
        updateBothCaches(newMonthKey, (transactions: Transaction[] = []) => {
          return transactions.filter(t => t.id !== id)
        })
        const txnToRestore = originalTransaction
        updateBothCaches(oldMonthKey, (transactions: Transaction[] = []) => {
          return sortTransactionsByDate([...transactions, txnToRestore])
        })
      } else {
        const txnToRestore = originalTransaction
        updateBothCaches(oldMonthKey, (transactions: Transaction[] = []) => {
          return transactions.map(t => (t.id === id ? txnToRestore : t))
        })
      }
      throw error
    }
  }

  const deleteTransaction = async (transaction: Transaction) => {
    const monthKey = getMonthKey(transaction.date)
    
    // Optimistically remove from cache immediately
    let removedTransaction: Transaction | undefined
    updateBothCaches(monthKey, (transactions: Transaction[] = []) => {
      removedTransaction = transactions.find(t => t.id === transaction.id)
      return transactions.filter(t => t.id !== transaction.id)
    })

    // Remove from single transaction cache
    mutate(getTransactionKey(transaction.id), null, false)

    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transaction.id)

      if (error) throw error
      
      // Invalidate year cache to ensure yearly summary is updated
      invalidateYearCache(transaction.date)
      // Revalidate overall totals
      mutate('/api/overall-totals', undefined, true)
      
      return transaction
    } catch (error) {
      // Rollback optimistic update on error
      if (removedTransaction) {
        updateBothCaches(monthKey, (transactions: Transaction[] = []) => {
          return [...transactions, removedTransaction!]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        })
        
        // Restore single transaction cache
        mutate(getTransactionKey(transaction.id), removedTransaction, false)
      }
      throw error
    }
  }

  return {
    addTransaction,
    updateTransaction,
    deleteTransaction
  }
} 
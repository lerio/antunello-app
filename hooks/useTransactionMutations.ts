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

  const addTransaction = async (data: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => {
    const monthKey = getMonthKey(data.date)
    
    // Calculate EUR amount for optimistic update
    let optimisticEurAmount = data.eur_amount
    if (!optimisticEurAmount) {
      if (data.currency === 'EUR') {
        optimisticEurAmount = data.amount
      }
      // For non-EUR, leave undefined so it shows loading state until conversion completes
    }
    
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
      const newList = [optimisticTransaction, ...transactions]
      // Sort by date descending to maintain proper order
      return newList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    })

    try {
      // Perform currency conversion for all currencies before database insert
      let transactionData = { ...data }
      
      if (!data.eur_amount) {
        if (data.currency === 'EUR') {
          // For EUR transactions, eur_amount = amount
          transactionData.eur_amount = data.amount
          transactionData.exchange_rate = 1.0
          transactionData.rate_date = data.date.split('T')[0]
        } else {
          // For non-EUR transactions, convert to EUR
          const conversionResult = await convertToEUR(data.amount, data.currency, data.date.split('T')[0])
          if (conversionResult) {
            transactionData.eur_amount = conversionResult.eurAmount
            transactionData.exchange_rate = conversionResult.exchangeRate
            transactionData.rate_date = conversionResult.rateDate
          }
        }
      }

      const { data: newTransaction, error } = await supabase
        .from('transactions')
        .insert([transactionData])
        .select()
        .single()

      if (error) throw error
      
      // Replace optimistic transaction with real one
      updateBothCaches(monthKey, (transactions: Transaction[] = []) => {
        return transactions.map(t => 
          t.id === optimisticTransaction.id ? newTransaction : t
        ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
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

  const updateTransaction = async (id: string, data: Partial<Transaction>, oldDate: string) => {
    const oldMonthKey = getMonthKey(oldDate)
    const newMonthKey = getMonthKey(data.date || oldDate)
    
    // Get the current transaction from cache for optimistic update
    let originalTransaction: Transaction | undefined

    // Helper function to calculate EUR amount for optimistic update
    const calculateOptimisticEurAmount = async (transaction: Transaction, updates: Partial<Transaction>) => {
      const newCurrency = updates.currency || transaction.currency
      const newAmount = updates.amount !== undefined ? updates.amount : transaction.amount
      const newDate = updates.date || transaction.date
      
      if (newCurrency === 'EUR') {
        return newAmount
      } else if (updates.amount !== undefined || updates.currency !== undefined || updates.date !== undefined) {
        // Try to calculate EUR amount optimistically for immediate feedback
        try {
          const conversionResult = await convertToEUR(newAmount, newCurrency, newDate.split('T')[0])
          return conversionResult?.eurAmount
        } catch (error) {
          // If conversion fails, clear the EUR amount so it gets recalculated by server
          return undefined
        }
      } else {
        // Keep existing EUR amount if no relevant changes
        return updates.eur_amount !== undefined ? updates.eur_amount : transaction.eur_amount
      }
    }

    // Optimistically update the cache immediately
    if (oldMonthKey !== newMonthKey) {
      // Moving between months
      updateBothCaches(oldMonthKey, (transactions: Transaction[] = []) => {
        originalTransaction = transactions.find(t => t.id === id)
        return transactions.filter(t => t.id !== id)
      })

      if (originalTransaction) {
        const optimisticEurAmount = await calculateOptimisticEurAmount(originalTransaction, data)
        const updatedTransaction = { 
          ...originalTransaction, 
          ...data,
          updated_at: new Date().toISOString(),
          ...(optimisticEurAmount !== undefined && { eur_amount: optimisticEurAmount }),
        }
        updateBothCaches(newMonthKey, (transactions: Transaction[] = []) => {
          const newList = [updatedTransaction, ...transactions]
          return newList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        })
      }
    } else {
      // Staying in same month - get original transaction first, then do async calculation
      updateBothCaches(oldMonthKey, (transactions: Transaction[] = []) => {
        originalTransaction = transactions.find(t => t.id === id)
        return transactions // Return unchanged for now
      })
      
      if (originalTransaction) {
        const optimisticEurAmount = await calculateOptimisticEurAmount(originalTransaction, data)
        updateBothCaches(oldMonthKey, (transactions: Transaction[] = []) => {
          return transactions.map(t => {
            if (t.id === id) {
              return { 
                ...t, 
                ...data,
                updated_at: new Date().toISOString(),
                ...(optimisticEurAmount !== undefined && { eur_amount: optimisticEurAmount }),
              }
            }
            return t
          }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        })
      }
    }

    try {
      // Perform currency conversion if needed before database update
      let updateData = { ...data }
      
      // Check if we need to recalculate EUR amount (for any currency when amount/currency/date changes)
      const needsCurrencyConversion = (
        updateData.amount !== undefined ||
        updateData.currency !== undefined ||
        updateData.date !== undefined
      ) && updateData.eur_amount === undefined // Only if EUR amount not explicitly provided
      
      if (needsCurrencyConversion && originalTransaction) {
        const newCurrency = updateData.currency || originalTransaction.currency
        const newAmount = updateData.amount !== undefined ? updateData.amount : originalTransaction.amount
        const newDate = updateData.date || originalTransaction.date
        
        if (newCurrency === 'EUR') {
          // For EUR transactions, eur_amount = amount
          updateData.eur_amount = newAmount
          updateData.exchange_rate = 1.0
          updateData.rate_date = newDate.split('T')[0]
        } else {
          // For non-EUR transactions, convert to EUR
          const conversionResult = await convertToEUR(newAmount, newCurrency, newDate.split('T')[0])
          if (conversionResult) {
            updateData.eur_amount = conversionResult.eurAmount
            updateData.exchange_rate = conversionResult.exchangeRate
            updateData.rate_date = conversionResult.rateDate
          }
        }
      }

      const { data: updatedTransaction, error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      // Update cache with real data
      if (oldMonthKey !== newMonthKey) {
        updateBothCaches(newMonthKey, (transactions: Transaction[] = []) => {
          return transactions.map(t => t.id === id ? updatedTransaction : t)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        })
      } else {
        updateBothCaches(oldMonthKey, (transactions: Transaction[] = []) => {
          return transactions.map(t => t.id === id ? updatedTransaction : t)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        })
      }

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
      if (originalTransaction) {
        if (oldMonthKey !== newMonthKey) {
          // Restore to old month
          updateBothCaches(newMonthKey, (transactions: Transaction[] = []) => {
            return transactions.filter(t => t.id !== id)
          })
          updateBothCaches(oldMonthKey, (transactions: Transaction[] = []) => {
            return [...transactions, originalTransaction!]
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          })
        } else {
          updateBothCaches(oldMonthKey, (transactions: Transaction[] = []) => {
            return transactions.map(t => t.id === id ? originalTransaction! : t)
          })
        }
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
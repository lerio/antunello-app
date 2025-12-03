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

  // Helper function to invalidate balance chart caches when transactions change
  const invalidateBalanceCaches = () => {
    const ranges = ['1m', '1y', '5y', 'all']
    const hiddenStates = [true, false]

    ranges.forEach(range => {
      hiddenStates.forEach(hidden => {
        // Invalidate range transactions cache
        // SWR key is an array: ['balance-transactions-${range}-${hidden}', range]
        mutate(
          (key) => Array.isArray(key) && key[0] === `balance-transactions-${range}-${hidden}`,
          undefined,
          { revalidate: true }
        )
        // Invalidate starting balance cache
        // SWR key is an array: ['starting-balance-${range}-${hidden}', range, hidden, userId]
        mutate(
          (key) => Array.isArray(key) && key[0] === `starting-balance-${range}-${hidden}`,
          undefined,
          { revalidate: true }
        )
      })
    })
  }

  // Helper to convert currency to EUR
  const convertAndUpdateCurrency = async (amount: number, currency: string, date: string): Promise<Partial<Transaction>> => {
    if (currency === 'EUR') {
      return { eur_amount: amount, exchange_rate: 1, rate_date: date.split('T')[0] }
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
      fund_category_id: data.fund_category_id || undefined
    }

    // Optimistically update the cache immediately
    updateBothCaches(monthKey, (transactions: Transaction[] = []) => {
      return sortTransactionsByDate([optimisticTransaction, ...transactions])
    })

    try {
      // Prepare transaction data with currency conversion
      const transactionData = {
        ...data,
        ...(data.eur_amount === undefined ? await convertAndUpdateCurrency(data.amount, data.currency, data.date) : {}),
        fund_category_id: data.fund_category_id || undefined
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
      // Invalidate balance chart caches to ensure chart is updated
      invalidateBalanceCaches()
      // Revalidate overall totals
      mutate('/api/overall-totals', undefined, true)
      // Revalidate fund categories to update balance
      mutate('fund-categories', undefined, true)

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
    const newAmount = updates.amount ?? transaction.amount
    const newDate = updates.date || transaction.date

    if (newCurrency === 'EUR') {
      return newAmount
    }

    if (!['amount', 'currency', 'date'].some(key => key in updates)) {
      // No relevant changes, keep existing EUR amount
      return updates.eur_amount ?? transaction.eur_amount
    }

    try {
      const conversionResult = await convertToEUR(newAmount, newCurrency, newDate.split('T')[0])
      return conversionResult?.eurAmount
    } catch {
      return undefined
    }
  }

  // Helper to update caches when transaction moves between months
  const updateCachesOnMonthChange = (oldMonthKey: string, newMonthKey: string, id: string, updatedTransaction: Transaction) => {
    updateBothCaches(oldMonthKey, (transactions: Transaction[] = []) => {
      return transactions.filter(t => t.id !== id)
    })
    updateBothCaches(newMonthKey, (transactions: Transaction[] = []) => {
      return sortTransactionsByDate([updatedTransaction, ...transactions])
    })
  }

  // Helper to update caches when transaction stays in same month
  const updateCachesInSameMonth = (monthKey: string, id: string, updatedTransaction: Transaction) => {
    updateBothCaches(monthKey, (transactions: Transaction[] = []) => {
      return sortTransactionsByDate(
        transactions.map(t => (t.id === id ? updatedTransaction : t))
      )
    })
  }

  // Helper: get original transaction from cache
  const getOriginalTransactionFromCache = (monthKey: string, id: string): Transaction | undefined => {
    let original: Transaction | undefined
    updateBothCaches(monthKey, (transactions: Transaction[] = []) => {
      original = transactions.find(t => t.id === id)
      return transactions
    })
    return original
  }

  // Helper: apply optimistic cache updates depending on month change
  const applyOptimisticUpdate = (oldMonthKey: string, newMonthKey: string, id: string, updated: Transaction) => {
    if (oldMonthKey === newMonthKey) {
      updateCachesInSameMonth(oldMonthKey, id, updated)
    } else {
      updateCachesOnMonthChange(oldMonthKey, newMonthKey, id, updated)
    }
  }

  // Helper: build update payload for DB
  const buildUpdateData = async (data: Partial<Transaction>, original: Transaction) => {
    const needsConversion = data.eur_amount === undefined && (data.amount !== undefined || data.currency !== undefined || data.date !== undefined)
    const amountToUse = data.amount ?? original.amount
    const currencyToUse = data.currency ?? original.currency
    const dateToUse = data.date ?? original.date

    if (needsConversion) {
      const conversion = await convertAndUpdateCurrency(amountToUse, currencyToUse, dateToUse)
      return {
        ...data,
        ...conversion,
        fund_category_id: data.fund_category_id
      }
    }
    return {
      ...data,
      fund_category_id: data.fund_category_id
    }
  }

  // Helper: finalize caches and invalidations after DB update
  const finalizeUpdate = (targetMonthKey: string, id: string, updatedTxn: Transaction, oldDate: string, newDate?: string) => {
    updateBothCaches(targetMonthKey, (transactions: Transaction[] = []) => {
      return sortTransactionsByDate(transactions.map(t => (t.id === id ? updatedTxn : t)))
    })
    mutate(getTransactionKey(id), updatedTxn, false)
    invalidateYearCache(oldDate)
    if (newDate && newDate !== oldDate) invalidateYearCache(newDate)
    invalidateBalanceCaches()
    mutate('/api/overall-totals', undefined, true)
    mutate('fund-categories', undefined, true)
  }

  // Helper: rollback caches on error
  const rollbackOptimisticUpdate = (oldMonthKey: string, newMonthKey: string, id: string, original: Transaction) => {
    if (oldMonthKey === newMonthKey) {
      const txnToRestore = original
      updateBothCaches(oldMonthKey, (transactions: Transaction[] = []) => transactions.map(t => (t.id === id ? txnToRestore : t)))
    } else {
      updateBothCaches(newMonthKey, (transactions: Transaction[] = []) => transactions.filter(t => t.id !== id))
      const txnToRestore = original
      updateBothCaches(oldMonthKey, (transactions: Transaction[] = []) => sortTransactionsByDate([...transactions, txnToRestore]))
    }
  }

  const updateTransaction = async (id: string, data: Partial<Transaction>, oldDate: string) => {
    const oldMonthKey = getMonthKey(oldDate)
    const newMonthKey = getMonthKey(data.date || oldDate)

    const originalTransaction = getOriginalTransactionFromCache(oldMonthKey, id)
    if (!originalTransaction) return

    const optimisticEurAmount = await calculateOptimisticEurAmount(originalTransaction, data)
    const optimisticUpdated: Transaction = {
      ...originalTransaction,
      ...data,
      updated_at: new Date().toISOString(),
      ...(optimisticEurAmount !== undefined && { eur_amount: optimisticEurAmount }),
      fund_category_id: data.fund_category_id
    }

    applyOptimisticUpdate(oldMonthKey, newMonthKey, id, optimisticUpdated)

    try {
      const updateData = await buildUpdateData(data, originalTransaction)


      const { data: persisted, error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error


      const targetMonthKey = oldMonthKey === newMonthKey ? oldMonthKey : newMonthKey
      finalizeUpdate(targetMonthKey, id, persisted, oldDate, data.date)
      return persisted
    } catch (error) {
      rollbackOptimisticUpdate(oldMonthKey, newMonthKey, id, originalTransaction)
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
      // Invalidate balance chart caches to ensure chart is updated
      invalidateBalanceCaches()
      // Revalidate overall totals
      mutate('/api/overall-totals', undefined, true)
      // Revalidate fund categories to update balance
      mutate('fund-categories', undefined, true)
      
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
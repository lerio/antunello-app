import { createClient } from '@/utils/supabase/client'
import { Transaction } from '@/types/database'
import { ImportResult, validateTransactionData } from '@/utils/csv-import'

/**
 * Delete all transactions for the current authenticated user
 */
export async function deleteAllUserTransactions() {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('User not authenticated')
  }

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('user_id', user.id)

  if (error) {
    throw new Error(`Failed to delete transactions: ${error.message}`)
  }

  return { success: true }
}

/**
 * Get transaction count for the current user
 */
export async function getUserTransactionCount() {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('User not authenticated')
  }

  const { count, error } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (error) {
    throw new Error(`Failed to count transactions: ${error.message}`)
  }

  return count || 0
}

/**
 * Import multiple transactions for the current user
 */
export async function importTransactions(
  transactions: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>[]
): Promise<ImportResult> {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('User not authenticated')
  }

  const result: ImportResult = {
    success: false,
    imported: 0,
    errors: [],
    skipped: 0
  }

  // Validate and process transactions in batches
  const validTransactions: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>[] = []
  
  for (let i = 0; i < transactions.length; i++) {
    const transaction = transactions[i]
    const validationErrors = validateTransactionData(transaction)
    
    if (validationErrors.length > 0) {
      result.errors.push(`Row ${i + 1}: ${validationErrors.join(', ')}`)
      result.skipped++
    } else {
      // Ensure user_id matches current user
      validTransactions.push({
        ...transaction,
        user_id: user.id
      })
    }
  }

  if (validTransactions.length === 0) {
    result.errors.push('No valid transactions to import')
    return result
  }

  // Import in batches of 100 to avoid hitting limits
  const batchSize = 100
  let totalImported = 0

  for (let i = 0; i < validTransactions.length; i += batchSize) {
    const batch = validTransactions.slice(i, i + batchSize)
    
    const { error, count } = await supabase
      .from('transactions')
      .insert(batch)

    if (error) {
      result.errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`)
    } else {
      totalImported += batch.length
    }
  }

  result.imported = totalImported
  result.success = totalImported > 0
  
  return result
}
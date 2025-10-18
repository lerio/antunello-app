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
  console.log('Import function started with', transactions.length, 'transactions');
  
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('User not authenticated')
  }

  console.log('User authenticated:', user.id);

  const result: ImportResult = {
    success: false,
    imported: 0,
    errors: [],
    skipped: 0
  }

  // Validate and process transactions in batches
  const validTransactions: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>[] = []
  
  console.log('Starting validation...');
  
  for (let i = 0; i < transactions.length; i++) {
    const transaction = transactions[i]
    const validationErrors = validateTransactionData(transaction)
    
    if (validationErrors.length > 0) {
      result.errors.push(`Row ${i + 1}: ${validationErrors.join(', ')}`)
      result.skipped++
      console.log(`Validation failed for row ${i + 1}:`, validationErrors);
    } else {
      // Ensure user_id matches current user
      validTransactions.push({
        ...transaction,
        user_id: user.id
      })
    }
  }

  console.log('Validation complete. Valid transactions:', validTransactions.length, 'Skipped:', result.skipped);

  if (validTransactions.length === 0) {
    result.errors.push('No valid transactions to import')
    console.log('No valid transactions to import');
    return result
  }

  // Import in batches of 100 to avoid hitting limits
  const batchSize = 100
  let totalImported = 0

  console.log('Starting database import in batches...');

  for (let i = 0; i < validTransactions.length; i += batchSize) {
    const batch = validTransactions.slice(i, i + batchSize)
    const batchNumber = Math.floor(i / batchSize) + 1;
    
    console.log(`Importing batch ${batchNumber}, size:`, batch.length);
    console.log('Sample transaction from batch:', batch[0]);
    
    // Retry logic for network failures
    let retryCount = 0;
    const maxRetries = 3;
    let success = false;
    
    while (retryCount <= maxRetries && !success) {
      try {
        const { error } = await supabase
          .from('transactions')
          .insert(batch)

        if (error) {
          throw error;
        } else {
          console.log(`Batch ${batchNumber} success, imported:`, batch.length);
          totalImported += batch.length
          success = true;
        }
      } catch (error: any) {
        retryCount++;
        console.error(`Batch ${batchNumber} attempt ${retryCount} error:`, error);
        
        if (retryCount <= maxRetries) {
          // Wait before retry, with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
          console.log(`Retrying batch ${batchNumber} in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // All retries failed
          console.error(`Batch ${batchNumber} failed after ${maxRetries} retries`);
          result.errors.push(`Batch ${batchNumber}: ${error.message} (failed after ${maxRetries} retries)`);
        }
      }
    }
  }

  result.imported = totalImported
  result.success = totalImported > 0
  
  console.log('Import complete. Total imported:', totalImported);

  // Revalidate overall totals
  try {
    const { mutate: globalMutate } = await import('swr')
    // In case dynamic import fails, fallback to require
    // @ts-ignore
    const gm = globalMutate || (require('swr').mutate)
    gm('/api/overall-totals', undefined, true)
  } catch (e) {
    // ignore if SWR not available in this context
  }
  
  return result
}
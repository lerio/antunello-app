/**
 * Provides high-level database utility functions for managing user
 * transactions in bulk: deleting all transactions, counting transactions,
 * and importing transactions from CSV or other sources with validation
 * and retry logic.
 */

import { createClient } from '@/utils/supabase/client'
import { Transaction } from '@/types/database'
import { ImportResult, validateTransactionData } from '@/utils/csv-import'

type TransactionInput = Omit<Transaction, 'id' | 'created_at' | 'updated_at'>

/**
 * Deletes all transactions for the currently authenticated user.
 *
 * @returns An object with `{ success: true }` when the operation completes.
 * @throws {Error} If the user is not authenticated or the database delete fails.
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
 * Returns the total number of transactions belonging to the current user.
 *
 * @returns The transaction count (0 if none).
 * @throws {Error} If the user is not authenticated or the count query fails.
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
 * Validates each transaction in the input list and enriches it with the
 * user ID, collecting any validation errors into the shared `ImportResult`.
 *
 * @param transactions - Array of transaction data to validate.
 * @param userId - The authenticated user's ID to assign to each transaction.
 * @param result - Accumulator object where skipped-count and error messages
 *   are recorded.
 * @returns A filtered array of valid transaction inputs ready for insertion.
 */
async function validateAndPrepareTransactions(
  transactions: TransactionInput[],
  userId: string,
  result: ImportResult
): Promise<TransactionInput[]> {
  console.log('Starting validation...');

  const validTransactions: TransactionInput[] = [];

  for (let i = 0; i < transactions.length; i++) {
    const transaction = transactions[i];
    const validationErrors = validateTransactionData(transaction);

    if (validationErrors.length > 0) {
      result.errors.push(`Row ${i + 1}: ${validationErrors.join(', ')}`);
      result.skipped++;
      console.log(`Validation failed for row ${i + 1}:`, validationErrors);
    } else {
      validTransactions.push({
        ...transaction,
        user_id: userId
      });
    }
  }

  console.log('Validation complete. Valid transactions:', validTransactions.length, 'Skipped:', result.skipped);
  return validTransactions;
}

/**
 * Inserts a single batch of transactions into the database, retrying up to
 * 3 times with exponential backoff on failure.
 *
 * @param supabase - The Supabase client instance.
 * @param batch - Array of validated transaction inputs to insert.
 * @param batchNumber - Human-readable batch number (for logging).
 * @param result - Accumulator object where error messages are recorded on
 *   final failure.
 * @returns The number of transactions successfully imported in this batch.
 */
async function importBatchWithRetry(
  supabase: any,
  batch: TransactionInput[],
  batchNumber: number,
  result: ImportResult
): Promise<number> {
  let retryCount = 0;
  const maxRetries = 3;
  let success = false;
  let imported = 0;

  console.log(`Importing batch ${batchNumber}, size:`, batch.length);
  console.log('Sample transaction from batch:', batch[0]);

  while (retryCount <= maxRetries && !success) {
    try {
      const { error } = await supabase
        .from('transactions')
        .insert(batch);

      if (error) {
        throw error;
      }

      console.log(`Batch ${batchNumber} success, imported:`, batch.length);
      imported = batch.length;
      success = true;
    } catch (error: any) {
      retryCount++;
      console.error(`Batch ${batchNumber} attempt ${retryCount} error:`, error);

      if (retryCount <= maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
        console.log(`Retrying batch ${batchNumber} in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error(`Batch ${batchNumber} failed after ${maxRetries} retries`);
        result.errors.push(`Batch ${batchNumber}: ${error.message} (failed after ${maxRetries} retries)`);
      }
    }
  }

  return imported;
}

/**
 * Imports a list of transactions for the currently authenticated user.
 *
 * The import process:
 * 1. Authenticates the current user.
 * 2. Validates each transaction (skipping invalid entries).
 * 3. Inserts valid transactions in batches of 100 with retry logic.
 * 4. Triggers a revalidation of the overall-totals API cache.
 *
 * @param transactions - Array of transaction data to import.
 * @returns An `ImportResult` summarising the number of successfully imported
 *   transactions, any errors encountered, and skipped rows.
 * @throws {Error} If the user is not authenticated.
 */
export async function importTransactions(
  transactions: TransactionInput[]
): Promise<ImportResult> {
  console.log('Import function started with', transactions.length, 'transactions');

  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  console.log('User authenticated:', user.id);

  const result: ImportResult = {
    success: false,
    imported: 0,
    errors: [],
    skipped: 0
  };

  // Validate transactions
  const validTransactions = await validateAndPrepareTransactions(transactions, user.id, result);

  if (validTransactions.length === 0) {
    result.errors.push('No valid transactions to import');
    console.log('No valid transactions to import');
    return result;
  }

  // Import in batches of 100
  const batchSize = 100;
  let totalImported = 0;

  console.log('Starting database import in batches...');

  for (let i = 0; i < validTransactions.length; i += batchSize) {
    const batch = validTransactions.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;

    const imported = await importBatchWithRetry(supabase, batch, batchNumber, result);
    totalImported += imported;
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
    // Handle gracefully if SWR is not available in this context
    console.warn('Skipping SWR revalidation after import:', e)
  }

  return result
}

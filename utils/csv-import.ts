/**
 * CSV import utilities for batch-importing transactions from Cashew-format CSV files.
 *
 * This module handles parsing raw CSV content, mapping CSV columns to the application's
 * Transaction data model, performing currency conversion with rate limiting, and
 * validating imported transaction data before insertion.
 *
 * @module utils/csv-import
 */

import { Transaction } from '@/types/database';
import { convertToEUR, batchConvertToEUR } from '@/utils/currency-conversion';

// Alias for insertable Transaction shape (omit DB-managed fields)
type InsertableTransaction = Omit<Transaction, 'id' | 'created_at' | 'updated_at'>;

/**
 * Represents a single transaction row parsed from a Cashew-format CSV file.
 */
export interface CSVTransaction {
  /** Name of the account the transaction belongs to */
  account: string;
  /** Transaction amount as a string (may include decimal separators) */
  amount: string;
  /** Three-letter currency code (e.g. "EUR", "USD") */
  currency: string;
  /** Transaction title / description */
  title: string;
  /** Additional notes or memo */
  note: string;
  /** Transaction date in the source format */
  date: string;
  /** Whether the transaction is an income ("true" / "false") */
  income: string;
  /** Transaction type string from CSV */
  type: string;
  /** Main category name from CSV */
  'category name': string;
  /** Subcategory name from CSV */
  'subcategory name': string;
  /** Color associated with the category (optional) */
  color: string;
  /** Icon identifier (optional) */
  icon: string;
  /** Emoji associated with the category (optional) */
  emoji: string;
  /** Budget amount (optional) */
  budget: string;
  /** Objective label (optional) */
  objective: string;
}

/**
 * Parses raw CSV content into an array of structured CSVTransaction objects.
 * Handles quoted fields and comma-separated values.
 *
 * @param csvContent - The raw CSV string content to parse
 * @returns An array of parsed CSVTransaction objects
 */
export function parseCSV(csvContent: string): CSVTransaction[] {
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',');

  const transactions: CSVTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length) {
      const transaction = {} as CSVTransaction;
      for (let index = 0; index < headers.length; index++) {
        const header = headers[index];
        (transaction as any)[header] = values[index];
      }
      transactions.push(transaction);
    }
  }

  return transactions;
}

/**
 * Parses a single CSV line handling quoted fields (fields enclosed in double quotes
 * may contain commas as part of the value).
 *
 * @param line - A single line from a CSV file
 * @returns An array of field values extracted from the line
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

/**
 * Maps a single CSV transaction row to the application's InsertableTransaction format,
 * including currency conversion to EUR via the Frankfurter API.
 *
 * @param csvTransaction - The parsed CSV transaction to map
 * @param userId - The authenticated user's ID to associate with the transaction
 * @returns A promise resolving to the mapped transaction ready for database insertion
 */
export async function mapCSVToTransaction(csvTransaction: CSVTransaction, userId: string): Promise<InsertableTransaction> {
  // Convert amount to positive number
  const amountValue = Math.abs(Number.parseFloat(csvTransaction.amount));

  // Map category names to match our new schema
  const categoryMapping: Record<string, string> = {
    'Dining': 'Dining',
    'Groceries': 'Groceries',
    'Shopping': 'Shopping',
    'Transportation': 'Transportation',
    'Entertainment': 'Entertainment',
    'Health': 'Health',
    'Services': 'Services',
    'Travel': 'Travel',
    'Fitness': 'Fitness',
    'Education': 'Education',
    'Gifts and Donations': 'Gifts and Donations',
    'Investment': 'Primary Income',
    'Primary Income': 'Primary Income',
    'Bank Movements': 'Bank Movements',
    'Personal Care': 'Personal Care',
    'Housing': 'Housing',
    'Insurance': 'Insurance',
    'Taxes and Fines': 'Taxes and Fines',
    'Government Benefits': 'Government Benefits',
    'Other Income': 'Other Income'
  };

  const mappedCategory = categoryMapping[csvTransaction['category name']] || 'Services';

  // Respect the CSV income field first - this is the source of truth
  const csvIsIncome = csvTransaction.income === 'true';
  const finalType: 'income' | 'expense' = csvIsIncome ? 'income' : 'expense';

  // Format date to ISO string and extract date part for currency conversion
  const transactionDate = new Date(csvTransaction.date);
  const dateISO = transactionDate.toISOString();
  const dateOnly = transactionDate.toISOString().split('T')[0]; // YYYY-MM-DD format

  // Convert to EUR if not already in EUR
  const conversionResult = await convertToEUR(amountValue, csvTransaction.currency, dateOnly);

  return {
    user_id: userId,
    amount: amountValue,
    currency: csvTransaction.currency,
    type: finalType,
    main_category: mappedCategory,
    sub_category: csvTransaction['subcategory name'] || undefined,
    title: csvTransaction.title,
    date: dateISO,
    // Currency conversion fields
    eur_amount: conversionResult?.eurAmount || undefined,
    exchange_rate: conversionResult?.exchangeRate || undefined,
    rate_date: conversionResult?.rateDate || undefined
  };
}

/**
 * Result summary for a CSV import operation, including counts of imported,
 * skipped, and errored transactions.
 */
export interface ImportResult {
  /** Whether the overall import completed without critical errors */
  success: boolean;
  /** Number of transactions successfully imported */
  imported: number;
  /** Array of error messages encountered during import */
  errors: string[];
  /** Number of transactions skipped (e.g., duplicates, validation failures) */
  skipped: number;
}

/**
 * Batch process CSV transactions with rate limiting for currency conversion.
 * Groups transactions by unique (date, currency) pairs to minimise API calls
 * and processes conversions in configurable batches with inter-batch delays.
 *
 * @param csvTransactions - Array of parsed CSV transactions to process
 * @param userId - The authenticated user's ID
 * @param progressCallback - Optional callback invoked after each transaction is processed
 *                          Receives the current count and total count
 * @returns A promise resolving to an array of insertable transactions
 */
export async function batchMapCSVToTransactions(
  csvTransactions: CSVTransaction[],
  userId: string,
  progressCallback?: (processed: number, total: number) => void
): Promise<InsertableTransaction[]> {
  const results: InsertableTransaction[] = [];

  // First, prepare basic transaction data without currency conversion
  const basicTransactions = csvTransactions.map((csvTransaction, index) => {
    const amountValue = Math.abs(Number.parseFloat(csvTransaction.amount));
    const categoryMapping: Record<string, string> = {
      'Dining': 'Dining',
      'Groceries': 'Groceries',
      'Shopping': 'Shopping',
      'Transportation': 'Transportation',
      'Entertainment': 'Entertainment',
      'Health': 'Health',
      'Services': 'Services',
      'Travel': 'Travel',
      'Fitness': 'Fitness',
      'Education': 'Education',
      'Gifts and Donations': 'Gifts and Donations',
      'Investment': 'Primary Income',
      'Primary Income': 'Primary Income',
      'Bank Movements': 'Bank Movements',
      'Personal Care': 'Personal Care',
      'Housing': 'Housing',
      'Insurance': 'Insurance',
      'Taxes and Fines': 'Taxes and Fines',
      'Government Benefits': 'Government Benefits',
      'Other Income': 'Other Income'
    };

    const mappedCategory = categoryMapping[csvTransaction['category name']] || 'Services';
    const csvIsIncome = csvTransaction.income === 'true';
    const finalType: 'income' | 'expense' = csvIsIncome ? 'income' : 'expense';

    const transactionDate = new Date(csvTransaction.date);
    const dateISO = transactionDate.toISOString();
    const dateOnly = transactionDate.toISOString().split('T')[0];

    return {
      basic: {
        user_id: userId,
        amount: amountValue,
        currency: csvTransaction.currency,
        type: finalType,
        main_category: mappedCategory,
        sub_category: csvTransaction['subcategory name'] || undefined,
        title: csvTransaction.title,
        date: dateISO,
      },
      conversion: {
        amount: amountValue,
        currency: csvTransaction.currency,
        date: dateOnly
      },
      index
    };
  });

  // Batch convert currencies
  console.log('Starting currency conversion for', basicTransactions.length, 'transactions');
  const conversionInputs = basicTransactions.map(t => t.conversion);
  const conversionResults = await batchConvertToEUR(conversionInputs, 5, 1000); // Smaller batches, longer delays
  console.log('Currency conversion complete, results:', conversionResults.length);

  // Combine basic data with conversion results
  for (let i = 0; i < basicTransactions.length; i++) {
    const basic = basicTransactions[i].basic;
    const conversion = conversionResults[i];

    const finalTransaction = {
      ...basic,
      eur_amount: conversion?.eurAmount || undefined,
      exchange_rate: conversion?.exchangeRate || undefined,
      rate_date: conversion?.rateDate || undefined
    };

    results.push(finalTransaction);

    // Call progress callback if provided
    if (progressCallback) {
      progressCallback(i + 1, basicTransactions.length);
    }
  }

  return results;
}

/**
 * Validates a single insertable transaction's required fields.
 * Checks that title, amount, currency, type, main_category, and date are all
 * present and valid.
 *
 * @param transaction - The transaction to validate
 * @returns An array of error message strings; empty array if the transaction is valid
 */
export function validateTransactionData(transaction: InsertableTransaction): string[] {
  const errors: string[] = [];

  if (!transaction.title || transaction.title.trim().length === 0) {
    errors.push('Title is required');
  }

  if (!transaction.amount || transaction.amount <= 0) {
    errors.push('Amount must be greater than 0');
  }

  if (!transaction.currency || transaction.currency.length !== 3) {
    errors.push('Currency must be a valid 3-letter code');
  }

  if (!transaction.type || !['expense', 'income'].includes(transaction.type)) {
    errors.push('Type must be either expense or income');
  }

  if (!transaction.main_category || transaction.main_category.trim().length === 0) {
    errors.push('Main category is required');
  }

  if (!transaction.date || Number.isNaN(new Date(transaction.date).getTime())) {
    errors.push('Valid date is required');
  }

  return errors;
}

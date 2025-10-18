import { Transaction } from '@/types/database';
import { convertToEUR, batchConvertToEUR } from '@/utils/currency-conversion';

export interface CSVTransaction {
  account: string;
  amount: string;
  currency: string;
  title: string;
  note: string;
  date: string;
  income: string;
  type: string;
  'category name': string;
  'subcategory name': string;
  color: string;
  icon: string;
  emoji: string;
  budget: string;
  objective: string;
}

export function parseCSV(csvContent: string): CSVTransaction[] {
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',');
  
  const transactions: CSVTransaction[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length) {
      const transaction = {} as CSVTransaction;
      headers.forEach((header, index) => {
        (transaction as any)[header] = values[index];
      });
      transactions.push(transaction);
    }
  }
  
  return transactions;
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
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

export async function mapCSVToTransaction(csvTransaction: CSVTransaction, userId: string): Promise<Omit<Transaction, 'id' | 'created_at' | 'updated_at'>> {
  // Convert amount to positive number
  const amountValue = Math.abs(parseFloat(csvTransaction.amount));
  
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

export interface ImportResult {
  success: boolean;
  imported: number;
  errors: string[];
  skipped: number;
}

/**
 * Batch process CSV transactions with rate limiting for currency conversion
 */
export async function batchMapCSVToTransactions(
  csvTransactions: CSVTransaction[], 
  userId: string,
  progressCallback?: (processed: number, total: number) => void
): Promise<Omit<Transaction, 'id' | 'created_at' | 'updated_at'>[]> {
  const results: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>[] = [];
  
  // First, prepare basic transaction data without currency conversion
  const basicTransactions = csvTransactions.map((csvTransaction, index) => {
    const amountValue = Math.abs(parseFloat(csvTransaction.amount));
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

export function validateTransactionData(transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>): string[] {
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
  
  if (!transaction.date || isNaN(new Date(transaction.date).getTime())) {
    errors.push('Valid date is required');
  }
  
  return errors;
}
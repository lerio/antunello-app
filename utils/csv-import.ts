import { Transaction } from '@/types/database';

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

export function mapCSVToTransaction(csvTransaction: CSVTransaction, userId: string): Omit<Transaction, 'id' | 'created_at' | 'updated_at'> {
  // Convert amount to positive number and determine type
  const amountValue = Math.abs(parseFloat(csvTransaction.amount));
  const isIncome = csvTransaction.income === 'true' || parseFloat(csvTransaction.amount) > 0;
  
  // Map category names to match our schema
  const categoryMapping: Record<string, string> = {
    'Dining': 'Dining',
    'Groceries': 'Groceries',
    'Shopping': 'Shopping',
    'Transportation': 'Transportation',
    'Entertainment': 'Entertainment',
    'Health': 'Health',
    'Services': 'Services',
    'Travel': 'Travel',
    'Work': 'Work',
    'Fitness': 'Fitness',
    'Education': 'Education',
    'Bills': 'Bills',
    'Gifts': 'Gifts',
    'Investment': 'Investment',
    'Bank Movements': 'Bank Movements'
  };

  const mappedCategory = categoryMapping[csvTransaction['category name']] || 'Services';
  
  // Format date to ISO string
  const date = new Date(csvTransaction.date).toISOString();
  
  return {
    user_id: userId,
    amount: amountValue,
    currency: csvTransaction.currency,
    type: isIncome ? 'income' : 'expense',
    main_category: mappedCategory,
    sub_category: csvTransaction['subcategory name'] || undefined,
    title: csvTransaction.title,
    date: date
  };
}

export interface ImportResult {
  success: boolean;
  imported: number;
  errors: string[];
  skipped: number;
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
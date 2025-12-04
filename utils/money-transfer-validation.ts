import { Transaction } from '@/types/database'

/**
 * Validates a money transfer transaction
 * Returns array of error messages, empty if valid
 */
export function validateMoneyTransfer(data: Partial<Transaction>): string[] {
  const errors: string[] = []

  if (!data.fund_category_id) {
    errors.push('Source fund is required')
  }

  if (!data.target_fund_category_id) {
    errors.push('Target fund is required')
  }

  if (data.fund_category_id && data.target_fund_category_id &&
      data.fund_category_id === data.target_fund_category_id) {
    errors.push('Source and target funds must be different')
  }

  if (!data.amount || data.amount <= 0) {
    errors.push('Amount must be greater than 0')
  }

  return errors
}

/**
 * Generates a formatted title for a money transfer
 * Format: "Source Fund ➡️ Target Fund"
 */
export function generateTransferTitle(sourceName: string, targetName: string): string {
  return `${sourceName} ➡️ ${targetName}`
}

/**
 * Checks if a transaction is a money transfer
 */
export function isMoneyTransfer(transaction: Transaction): boolean {
  return transaction.is_money_transfer === true
}

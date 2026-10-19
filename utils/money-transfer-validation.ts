/**
 * Money transfer validation and title generation utilities.
 *
 * Provides functions for validating money transfer transactions between
 * fund categories, generating descriptive transfer titles, and checking
 * whether a transaction is a money transfer.
 *
 * @module utils/money-transfer-validation
 */

import { Transaction } from '@/types/database'

/**
 * Generates a formatted title for a money transfer.
 * Format: "Source Fund ➡️ Target Fund"
 *
 * @param sourceName - The display name of the source fund category
 * @param targetName - The display name of the target fund category
 * @returns The formatted transfer title string with arrow separator
 */
export function generateTransferTitle(sourceName: string, targetName: string): string {
  return `${sourceName} ➡️ ${targetName}`
}

/**
 * Checks if a transaction is a money transfer based on the is_money_transfer flag.
 *
 * @param transaction - The transaction to check
 * @returns True if the transaction is a money transfer
 */
export function isMoneyTransfer(transaction: Transaction): boolean {
  return transaction.is_money_transfer === true
}

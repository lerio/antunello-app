/**
 * Transaction sorting utilities.
 *
 * Provides functions for sorting transaction arrays by date (descending)
 * and then by creation timestamp (descending), both as immutable copies
 * and in-place mutations.
 *
 * @module utils/transaction-utils
 */

import { Transaction } from "@/types/database";

/**
 * Sorts transactions by date (descending), then by created_at (descending).
 * Returns a new sorted array without mutating the original.
 *
 * @param transactions - The array of transactions to sort
 * @returns A new array sorted by date descending, then created_at descending
 */
export function sortTransactionsByDate(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => {
    const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (dateCompare !== 0) return dateCompare;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

/**
 * Sorts transactions in place by date (descending), then by created_at (descending).
 * Mutates and returns the original array.
 *
 * @param transactions - The array of transactions to sort (mutated in place)
 * @returns The same array reference, now sorted in place
 */
export function sortTransactionsByDateInPlace(transactions: Transaction[]): Transaction[] {
  return transactions.sort((a, b) => {
    const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (dateCompare !== 0) return dateCompare;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

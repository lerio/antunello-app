import { Transaction } from "@/types/database";

/**
 * Sorts transactions by date (descending), then by created_at (descending).
 * Returns a new sorted array without mutating the original.
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
 */
export function sortTransactionsByDateInPlace(transactions: Transaction[]): Transaction[] {
  return transactions.sort((a, b) => {
    const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (dateCompare !== 0) return dateCompare;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

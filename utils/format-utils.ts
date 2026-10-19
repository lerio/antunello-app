/**
 * Number and amount formatting utilities.
 *
 * Provides functions for formatting monetary amounts without currency symbols,
 * for contexts where the symbol is shown separately.
 *
 * @module utils/format-utils
 */

import { formatCurrency } from "@/utils/currency";

/**
 * Formats an amount without currency symbols.
 * Uses EUR formatting internally for consistent thousand separators and decimal places,
 * then strips the currency symbol characters to produce a clean numeric string.
 *
 * @param amount - The numeric amount to format
 * @returns A formatted number string without currency symbols
 */
export function formatAmountWithoutSymbol(amount: number): string {
  return formatCurrency(amount, "EUR")
    .replaceAll("€", "")
    .replaceAll("$", "")
    .replaceAll("£", "")
    .replaceAll("¥", "")
    .replaceAll("₹", "")
    .trim();
}

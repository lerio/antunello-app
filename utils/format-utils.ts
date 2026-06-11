/**
 * Number and amount formatting utilities.
 *
 * Provides functions for formatting monetary amounts without currency symbols,
 * and general number formatting with consistent decimal places. Useful for
 * displaying values in contexts where currency symbols are shown separately
 * or when a clean numeric display is needed.
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

/**
 * Formats a number with 2 decimal places using US locale.
 * Produces output like "1,234.56" without any currency symbols.
 *
 * @param amount - The number to format
 * @returns A formatted number string with 2 decimal places
 */
export function formatNumber(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

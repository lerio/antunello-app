import { formatCurrency } from "@/utils/currency";

/**
 * Formats an amount without currency symbols.
 * Uses EUR formatting for consistent thousand separators and decimal places.
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
 * Does not include currency symbols.
 */
export function formatNumber(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

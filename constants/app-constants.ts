/**
 * Currency options for transaction forms
 */
export const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD", symbol: "$" },
  { value: "EUR", label: "EUR", symbol: "€" },
  { value: "JPY", label: "JPY", symbol: "¥" },
] as const;

export type CurrencyOption = (typeof CURRENCY_OPTIONS)[number];

/**
 * Full list of supported currencies for fund management
 */
export const CURRENCIES = [
  "EUR",
  "USD",
  "GBP",
  "JPY",
  "CHF",
  "CAD",
  "AUD",
  "CNY",
] as const;

export type Currency = (typeof CURRENCIES)[number];

/**
 * Helper to get currency symbol from currency code
 */
export function getCurrencySymbol(currency: string): string {
  const option = CURRENCY_OPTIONS.find((c) => c.value === currency);
  return option?.symbol || "€";
}

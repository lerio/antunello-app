/**
 * @file Application-wide constants for currency configuration. Defines
 * the set of currencies used for transactions and fund management,
 * their display labels and symbols, and a helper to resolve a symbol
 * from a currency code.
 */

/**
 * Currency options for transaction forms.
 * Each entry includes a code, display label, and currency symbol.
 */
export const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD", symbol: "$" },
  { value: "EUR", label: "EUR", symbol: "€" },
  { value: "JPY", label: "JPY", symbol: "¥" },
] as const;

/**
 * Full list of supported currencies for fund management.
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

/** A supported currency code as defined in {@link CURRENCIES}. */
export type Currency = (typeof CURRENCIES)[number];


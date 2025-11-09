/**
 * Normalizes decimal separators in number strings
 * Converts commas to dots for proper JavaScript number parsing
 */
export function normalizeDecimalSeparator(value: string): string {
  return value.replace(/,/g, '.');
}

/**
 * Parses a number string with proper decimal separator handling
 * Supports both comma and dot as decimal separators
 */
export function parseNumber(value: string): number {
  const normalized = normalizeDecimalSeparator(value);
  return Number(normalized);
}

/**
 * Validates if a string represents a valid positive number
 * Handles both comma and dot decimal separators
 */
export function isValidPositiveNumber(value: string): boolean {
  if (!value || value.trim() === '') return false;

  const normalized = normalizeDecimalSeparator(value);
  const num = Number(normalized);

  return !Number.isNaN(num) && num > 0;
}
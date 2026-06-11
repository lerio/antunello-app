/**
 * Split-across-year transaction expansion utilities.
 *
 * Provides functions for distributing the amount of a single transaction evenly
 * across 12 months (split across the year), handling partial-month display,
 * rounding to minor units for currency precision, and expanding original
 * split transactions into individual monthly instances for display in both
 * month and year views.
 *
 * @module utils/split-transactions
 */

import { Transaction } from '@/types/database'
import { getCurrencyFractionDigits } from '@/utils/currency-amount-input'

const SPLIT_PARTS = 12

/**
 * Calculates the minor units factor (10^fractionDigits) for a given currency precision.
 * For example, EUR with 2 fraction digits returns 100.
 *
 * @param fractionDigits - Number of decimal places
 * @returns The factor for converting between major and minor currency units
 */
function getMinorUnitsFactor(fractionDigits: number): number {
  return Math.pow(10, Math.max(0, fractionDigits))
}

/**
 * Rounds an amount to the nearest minor unit for the given currency precision.
 *
 * @param amount - The amount to round in major units
 * @param fractionDigits - Number of decimal places for the currency
 * @returns The amount expressed in minor units (integer)
 */
function roundToMinorUnits(amount: number, fractionDigits: number): number {
  const factor = getMinorUnitsFactor(fractionDigits)
  return Math.sign(amount) * Math.round(Math.abs(amount) * factor)
}

/**
 * Converts minor units back to the major unit representation.
 *
 * @param minorUnits - The amount in minor units (integer)
 * @param fractionDigits - Number of decimal places for the currency
 * @returns The amount in major units
 */
function minorUnitsToAmount(minorUnits: number, fractionDigits: number): number {
  return minorUnits / getMinorUnitsFactor(fractionDigits)
}

/**
 * Calculates the rounded minor unit values for each split, distributing the
 * remainder into January to avoid rounding discrepancies across all months.
 *
 * @param totalAmount - The total transaction amount to split
 * @param fractionDigits - Number of decimal places for the currency
 * @returns An object with the regular month minor unit amount and the January amount
 */
function getRoundedSplitMinorUnits(
  totalAmount: number,
  fractionDigits: number
): { regularMonthMinorUnits: number; januaryMinorUnits: number } {
  const totalMinorUnits = roundToMinorUnits(totalAmount, fractionDigits)
  const regularMonthMinorUnits = roundToMinorUnits(totalAmount / SPLIT_PARTS, fractionDigits)
  const januaryMinorUnits = totalMinorUnits - regularMonthMinorUnits * (SPLIT_PARTS - 1)

  return { regularMonthMinorUnits, januaryMinorUnits }
}

/**
 * Gets the rounded split amount for a specific month.
 * January receives any rounding remainder to ensure the sum of all 12
 * monthly amounts equals the original total.
 *
 * @param totalAmount - The total transaction amount to split across 12 months
 * @param month - The month number (1-12) to get the split amount for
 * @param fractionDigits - Number of decimal places for the currency (default: 2)
 * @returns The rounded split amount for the specified month
 */
export function getRoundedSplitAmountForMonth(
  totalAmount: number,
  month: number,
  fractionDigits = 2
): number {
  const { regularMonthMinorUnits, januaryMinorUnits } = getRoundedSplitMinorUnits(totalAmount, fractionDigits)
  return month === 1
    ? minorUnitsToAmount(januaryMinorUnits, fractionDigits)
    : minorUnitsToAmount(regularMonthMinorUnits, fractionDigits)
}

/**
 * Gets the rounded split amount for a specific month, safely handling
 * null and undefined total amounts by passing them through unchanged.
 *
 * @param totalAmount - The total transaction amount, or null/undefined
 * @param month - The month number (1-12) to get the split amount for
 * @param fractionDigits - Number of decimal places for the currency (default: 2)
 * @returns The rounded split amount, or the original null/undefined value
 */
export function getRoundedOptionalSplitAmountForMonth(
  totalAmount: number | null | undefined,
  month: number,
  fractionDigits = 2
): number | null | undefined {
  if (totalAmount === undefined || totalAmount === null) {
    return totalAmount
  }

  return getRoundedSplitAmountForMonth(totalAmount, month, fractionDigits)
}

/**
 * Returns the number of days in a given month and year.
 *
 * @param year - The year
 * @param month - The month number (1-12)
 * @returns The number of days in the month
 */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/**
 * Creates a date for a split transaction instance, ensuring the day
 * does not exceed the target month's maximum days (clamped to end of month).
 *
 * @param baseDate - The original transaction date
 * @param year - The target year for the instance
 * @param month - The target month (1-12) for the instance
 * @returns A new Date object for the split instance
 */
function getSplitInstanceDate(baseDate: Date, year: number, month: number): Date {
  const day = Math.min(baseDate.getDate(), daysInMonth(year, month))
  return new Date(
    year,
    month - 1,
    day,
    baseDate.getHours(),
    baseDate.getMinutes(),
    baseDate.getSeconds(),
    baseDate.getMilliseconds()
  )
}

/**
 * Gets the display amount for a transaction, respecting split display amounts.
 * If the transaction has a split_display_amount, that value is returned.
 * Otherwise falls back to the original amount.
 *
 * @param transaction - The transaction to get the display amount for
 * @returns The amount to display (may be original or split-adjusted)
 */
export function getTransactionDisplayAmount(transaction: Transaction): number {
  if (transaction.split_display_amount !== undefined) {
    return transaction.split_display_amount
  }
  return transaction.amount
}

/**
 * Gets the display EUR amount for a transaction, respecting split display amounts.
 * If the transaction has a split_display_eur_amount, that value is returned.
 * Otherwise falls back to the original eur_amount.
 *
 * @param transaction - The transaction to get the display EUR amount for
 * @returns The EUR amount to display, or undefined if not available
 */
export function getTransactionDisplayEurAmount(transaction: Transaction): number | undefined {
  if (transaction.split_display_eur_amount !== undefined) {
    return transaction.split_display_eur_amount ?? undefined
  }
  return transaction.eur_amount
}

/**
 * Calculates the expected total split EUR amount for transactions not yet visible
 * in the current view. Sums the absolute EUR amounts of all split-across-year
 * transactions that are not currently shown as visible instances.
 *
 * @param allSplitTransactions - All split transactions in the year
 * @param visibleTransactions - The visible (already expanded) split instances
 * @returns The total expected EUR amount of non-visible split portions
 */
export function calculateExpectedSplitAmountEur(
  allSplitTransactions: ReadonlyArray<Transaction>,
  visibleTransactions: ReadonlyArray<Transaction>
): number {
  if (!allSplitTransactions.length) return 0

  const visibleSplitIds = new Set(
    visibleTransactions.filter((t) => t.split_across_year).map((t) => t.id)
  )

  let total = 0
  for (const tx of allSplitTransactions) {
    if (visibleSplitIds.has(tx.id)) continue

    const eurAmount =
      getTransactionDisplayEurAmount(tx) ??
      (tx.currency === 'EUR' ? getTransactionDisplayAmount(tx) : 0)

    if (eurAmount === 0 && tx.currency !== 'EUR') continue
    total += Math.abs(eurAmount)
  }

  return total
}

/**
 * Expands split-across-year transactions into individual monthly instances for
 * a specific month view. Creates read-only copies for months other than the
 * original, with recalculated split amounts and adjusted dates.
 *
 * @param monthTransactions - Transactions for the target month (some may be split-across-year)
 * @param splitTransactionsInYear - All split-across-year transactions in the year
 * @param targetYear - The target year for the month view
 * @param targetMonth - The target month (1-12) for the view
 * @param now - Current date (defaults to new Date()) for filtering future instances
 * @returns Combined array of regular and expanded split transaction instances
 */
export function expandSplitTransactionsForMonth(
  monthTransactions: Transaction[],
  splitTransactionsInYear: Transaction[],
  targetYear: number,
  targetMonth: number,
  now = new Date()
): Transaction[] {
  const regularTransactions = monthTransactions.filter((t) => !t.split_across_year)
  const splitInstances: Transaction[] = []

  for (const splitSource of splitTransactionsInYear) {
    const baseDate = new Date(splitSource.date)
    if (Number.isNaN(baseDate.getTime())) continue
    if (baseDate.getFullYear() !== targetYear) continue

    const instanceDate = getSplitInstanceDate(baseDate, targetYear, targetMonth)
    if (instanceDate.getTime() > now.getTime()) continue

    const isOriginalMonth = baseDate.getMonth() + 1 === targetMonth
    const amountFractionDigits = getCurrencyFractionDigits(splitSource.currency)
    const splitAmount = getRoundedSplitAmountForMonth(splitSource.amount, targetMonth, amountFractionDigits)
    const splitEurAmount = getRoundedOptionalSplitAmountForMonth(splitSource.eur_amount, targetMonth, 2)

    if (isOriginalMonth) {
      splitInstances.push({
        ...splitSource,
        split_is_read_only: false,
        split_source_transaction_id: null,
        split_display_amount: splitAmount,
        split_display_eur_amount: splitEurAmount,
      })
      continue
    }

    splitInstances.push({
      ...splitSource,
      id: `${splitSource.id}::split::${targetYear}-${String(targetMonth).padStart(2, '0')}`,
      amount: splitAmount,
      eur_amount: splitEurAmount ?? undefined,
      date: instanceDate.toISOString(),
      split_is_read_only: true,
      split_source_transaction_id: splitSource.id,
      split_display_amount: splitAmount,
      split_display_eur_amount: splitEurAmount,
    })
  }

  return [...regularTransactions, ...splitInstances]
}

/**
 * Expands split-across-year transactions into individual monthly instances for
 * an entire year view. Generates all 12 months of instances for each
 * split source, with read-only copies for months other than the original.
 *
 * @param yearTransactions - All transactions in the year (some may be split-across-year)
 * @param targetYear - The target year to expand instances for
 * @param now - Current date (defaults to new Date()) for filtering future instances
 * @returns Combined array of regular and expanded split transaction instances for the full year
 */
export function expandSplitTransactionsForYear(
  yearTransactions: Transaction[],
  targetYear: number,
  now = new Date()
): Transaction[] {
  const regularTransactions = yearTransactions.filter((t) => !t.split_across_year)
  const splitSources = yearTransactions.filter((t) => t.split_across_year)
  const splitInstances: Transaction[] = []

  for (const splitSource of splitSources) {
    const baseDate = new Date(splitSource.date)
    if (Number.isNaN(baseDate.getTime())) continue
    if (baseDate.getFullYear() !== targetYear) continue

    for (let month = 1; month <= 12; month += 1) {
      const instanceDate = getSplitInstanceDate(baseDate, targetYear, month)
      if (instanceDate.getTime() > now.getTime()) continue

      const isOriginalMonth = baseDate.getMonth() + 1 === month
      const amountFractionDigits = getCurrencyFractionDigits(splitSource.currency)
      const splitAmount = getRoundedSplitAmountForMonth(splitSource.amount, month, amountFractionDigits)
      const splitEurAmount = getRoundedOptionalSplitAmountForMonth(splitSource.eur_amount, month, 2)

      if (isOriginalMonth) {
        splitInstances.push({
          ...splitSource,
          split_is_read_only: false,
          split_source_transaction_id: null,
          split_display_amount: splitAmount,
          split_display_eur_amount: splitEurAmount,
        })
      } else {
        splitInstances.push({
          ...splitSource,
          id: `${splitSource.id}::split::${targetYear}-${String(month).padStart(2, '0')}`,
          amount: splitAmount,
          eur_amount: splitEurAmount ?? undefined,
          date: instanceDate.toISOString(),
          split_is_read_only: true,
          split_source_transaction_id: splitSource.id,
          split_display_amount: splitAmount,
          split_display_eur_amount: splitEurAmount,
        })
      }
    }
  }

  return [...regularTransactions, ...splitInstances]
}

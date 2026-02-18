import { Transaction } from '@/types/database'
import { getCurrencyFractionDigits } from '@/utils/currency-amount-input'

const SPLIT_PARTS = 12

function getMinorUnitsFactor(fractionDigits: number): number {
  return Math.pow(10, Math.max(0, fractionDigits))
}

function roundToMinorUnits(amount: number, fractionDigits: number): number {
  const factor = getMinorUnitsFactor(fractionDigits)
  return Math.sign(amount) * Math.round(Math.abs(amount) * factor)
}

function minorUnitsToAmount(minorUnits: number, fractionDigits: number): number {
  return minorUnits / getMinorUnitsFactor(fractionDigits)
}

function getRoundedSplitMinorUnits(
  totalAmount: number,
  fractionDigits: number
): { regularMonthMinorUnits: number; januaryMinorUnits: number } {
  const totalMinorUnits = roundToMinorUnits(totalAmount, fractionDigits)
  const regularMonthMinorUnits = roundToMinorUnits(totalAmount / SPLIT_PARTS, fractionDigits)
  const januaryMinorUnits = totalMinorUnits - regularMonthMinorUnits * (SPLIT_PARTS - 1)

  return { regularMonthMinorUnits, januaryMinorUnits }
}

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

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

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

export function getTransactionDisplayAmount(transaction: Transaction): number {
  if (transaction.split_display_amount !== undefined) {
    return transaction.split_display_amount
  }
  return transaction.amount
}

export function getTransactionDisplayEurAmount(transaction: Transaction): number | undefined {
  if (transaction.split_display_eur_amount !== undefined) {
    return transaction.split_display_eur_amount ?? undefined
  }
  return transaction.eur_amount
}

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

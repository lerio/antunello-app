import { useMemo } from 'react'
import useSWR from 'swr'
import { createClient } from '@/utils/supabase/client'
import { fetchAllBatches } from '@/utils/supabase/fetch-all'
import { Transaction } from '@/types/database'
import { getStartDateForTimeRange, type TimeRange } from '@/utils/time-range'
import { getComparisonWindows30 } from '@/utils/comparison-windows'
import { expandSplitTransactionsForYear } from '@/utils/split-transactions'

/**
 * A single data point in the balance time series.
 */
export interface BalanceDataPoint {
  /** ISO date string representing the start of this bucket (e.g. `"2024-01-01"`). */
  date: string
  /** Running balance at the end of this bucket, anchored so the last point equals the Balance card total. */
  balance: number
  /** Total income amount accumulated within this bucket. */
  income: number
  /** Total expense amount accumulated within this bucket. */
  expense: number
  /** Number of transactions that fell within this bucket. */
  transactionCount: number
}

/**
 * A balance data point extended with the split-adjusted series value.
 *
 * `splitAdjustedBalance` is the balance with every split-across-year
 * transaction spread over its rolling 12 months instead of booked at full
 * amount on its source date. It is `null` wherever it matches `balance`
 * (difference <= 0.005).
 */
export interface AnchoredDataPoint extends BalanceDataPoint {
  /** Balance with split transactions accrued month by month, or `null` when it matches `balance`. */
  splitAdjustedBalance?: number | null
}

/**
 * Slim transaction row returned by the anchored fetcher. Cast to the full
 * `Transaction` type for compatibility with the split utils (same pattern as
 * `utils/date-range-fetcher.ts`).
 */
type AnchoredRow = Pick<
  Transaction,
  | 'id'
  | 'amount'
  | 'currency'
  | 'type'
  | 'date'
  | 'eur_amount'
  | 'hide_from_totals'
  | 'is_money_transfer'
  | 'split_across_year'
>

/**
 * Lightweight transaction representation used for balance calculations.
 * Only includes fields necessary for summing income/expense across a date range.
 */
type SeriesRow = {
  /** ISO date string of the transaction */
  date: string
  /** `'expense'` or `'income'` */
  type: 'expense' | 'income'
  /** Amount in EUR (nullable for transactions without a rate) */
  eur_amount: number | null
  /** Split display amount in EUR when the row is a split instance */
  split_display_eur_amount?: number | null
  /** Whether the transaction is a money transfer between fund categories */
  is_money_transfer: boolean | null
}

/**
 * Fetches the transactions driving the anchored balance series.
 *
 * Fetches all rows in the window (split sources counted as-is at full
 * amount, like the Balance card) plus split sources dated before the window
 * with no lower bound — pre-window sources of the same calendar year still
 * produce in-window monthly instances, which the split adjustment needs.
 * Rows are bounded at `now` (future rows only ever act as a constant offset
 * baked into the anchor, so they are never needed by the walk-back).
 */
const anchoredTransactionsFetcher = async (
  _key: string,
  timeRange: TimeRange
): Promise<Transaction[]> => {
  const supabase = createClient()
  const now = new Date()
  const nowIso = now.toISOString()
  const startDate =
    timeRange === '1m'
      ? getComparisonWindows30().current.start
      : getStartDateForTimeRange(timeRange)

  // Slim columns match the shape needed by the series builders; cast to the
  // full Transaction type for compatibility with the split utils (same
  // pattern as utils/date-range-fetcher.ts).
  const slimSelect =
    'id, amount, currency, type, date, eur_amount, hide_from_totals, is_money_transfer, split_across_year'

  let inWindowQuery = supabase
    .from('transactions')
    .select(slimSelect)
    .lte('date', nowIso)
    .order('date', { ascending: true })
  if (startDate) {
    inWindowQuery = inWindowQuery.gte('date', startDate)
  }

  const inWindow = (await fetchAllBatches<AnchoredRow>((from, to) =>
    inWindowQuery.range(from, to)
  )) as Transaction[]

  const olderSplits = startDate
    ? ((await fetchAllBatches<AnchoredRow>((from, to) =>
        supabase
          .from('transactions')
          .select(slimSelect)
          .eq('split_across_year', true)
          .lt('date', startDate)
          .lte('date', nowIso)
          .order('date', { ascending: true })
          .range(from, to)
      )) as Transaction[])
    : []

  return [...olderSplits, ...inWindow]
}

function parseUtcDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`)
}

function formatUtcDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Bucket start for a date: UTC midnight, Monday-of-week for `5y`, and
 * month start for `all`.
 */
function getBucketStart(date: Date, timeRange: TimeRange): Date {
  const result = new Date(date)
  result.setUTCHours(0, 0, 0, 0)

  if (timeRange === '5y') {
    const day = result.getUTCDay()
    const delta = day === 0 ? -6 : 1 - day
    result.setUTCDate(result.getUTCDate() + delta)
  } else if (timeRange === 'all') {
    result.setUTCDate(1)
  }

  return result
}

function addBucket(date: Date, timeRange: TimeRange): Date {
  const result = new Date(date)
  if (timeRange === '5y') {
    result.setUTCDate(result.getUTCDate() + 7)
  } else if (timeRange === 'all') {
    result.setUTCMonth(result.getUTCMonth() + 1)
  } else {
    result.setUTCDate(result.getUTCDate() + 1)
  }
  return result
}

function getBucketKey(date: Date, _timeRange: TimeRange): string {
  return date.toISOString().split('T')[0]
}

/**
 * Bucket index for a transaction date within the grid: `0`-based index of
 * the bucket whose start is the latest one <= the transaction's date.
 * Computed directly (day/week/month arithmetic) instead of scanning buckets.
 */
function getBucketIndex(
  txDate: Date,
  start: Date,
  timeRange: TimeRange
): number {
  const txBucketStart = getBucketStart(txDate, timeRange)
  const diffMs = txBucketStart.getTime() - start.getTime()
  if (timeRange === '5y') {
    return Math.round(diffMs / (7 * 24 * 60 * 60 * 1000))
  }
  if (timeRange === 'all') {
    return (
      (txDate.getUTCFullYear() - start.getUTCFullYear()) * 12 +
      (txDate.getUTCMonth() - start.getUTCMonth())
    )
  }
  return Math.round(diffMs / (24 * 60 * 60 * 1000))
}

function getAmount(tx: SeriesRow): number {
  return tx.split_display_eur_amount !== null &&
    tx.split_display_eur_amount !== undefined
    ? tx.split_display_eur_amount
    : (tx.eur_amount as number)
}

function signedAmount(tx: SeriesRow): number {
  return (tx.type === 'income' ? 1 : -1) * getAmount(tx)
}

/**
 * Keeps transactions relevant to the balance series: excludes money
 * transfers (the card nets them to zero) and rows without a usable EUR
 * amount. Hidden rows are kept — the Balance card has no
 * `hide_from_totals` filter.
 */
function filterSeriesTransactions(transactions: SeriesRow[]): SeriesRow[] {
  return transactions.filter(
    (tx) =>
      !tx.is_money_transfer &&
      (tx.split_display_eur_amount !== null &&
      tx.split_display_eur_amount !== undefined
        ? true
        : tx.eur_amount !== null && tx.eur_amount !== undefined)
  )
}

function earliestDate(dates: string[]): string | null {
  let earliest: string | null = null
  for (const date of dates) {
    const day = date.split('T')[0]
    if (!earliest || day < earliest) earliest = day
  }
  return earliest
}

/**
 * Per-bucket adjustment from "booked at full amount" (the card's model) to
 * "accrued month by month" for split-across-year transactions.
 *
 * For a split with source date `S`, signed full amount `F`, and signed
 * monthly instances `f_1..f_k` (up to `now`): buckets ending before `S` get
 * no adjustment (neither model has booked anything yet); buckets ending at
 * or after `S` get `F - Σ f_i` accumulated so far, so the adjusted value
 * reflects only the accrued months. Once a split's 12-month window has
 * fully accrued, its adjustment is zero again.
 */
function buildSplitAdjustments(
  transactions: Transaction[],
  bucketCount: number,
  start: Date,
  timeRange: TimeRange,
  now: Date
): number[] {
  const adjust = new Array<number>(bucketCount).fill(0)
  const splitSources = transactions.filter(
    (t) => t.split_across_year && !t.is_money_transfer
  )
  if (splitSources.length === 0) return adjust

  const nowYear = now.getUTCFullYear()

  for (const source of splitSources) {
    const sourceRow = toSeriesRow(source)
    // Match the real series filter: skip splits without a usable EUR amount.
    if (sourceRow.eur_amount === null && sourceRow.split_display_eur_amount == null) {
      continue
    }
    const signedFull = signedAmount(sourceRow)

    // Expand this source's rolling window over every year it can touch.
    // Includes the original-month instance (the first accrued slice), which
    // the expander returns as the source row with a split display amount.
    const sourceYear = new Date(source.date).getUTCFullYear()
    const instances: Array<{ idx: number; signed: number }> = []
    for (let y = sourceYear; y <= nowYear; y += 1) {
      for (const inst of expandSplitTransactionsForYear([source], y, now)) {
        const row = toSeriesRow(inst)
        if (row.eur_amount === null && row.split_display_eur_amount == null) continue
        const idx = getBucketIndex(new Date(inst.date), start, timeRange)
        if (idx >= bucketCount) continue
        instances.push({ idx, signed: signedAmount(row) })
      }
    }

    instances.sort((a, b) => a.idx - b.idx)

    const sourceIdx = getBucketIndex(new Date(source.date), start, timeRange)

    // Instances dated before the window are already accrued for every
    // in-window bucket.
    let acc = 0
    let k = 0
    while (k < instances.length && instances[k].idx < 0) {
      acc += instances[k].signed
      k += 1
    }

    const startI = Math.max(0, sourceIdx)
    for (let i = startI; i < bucketCount; i += 1) {
      while (k < instances.length && instances[k].idx <= i) {
        acc += instances[k].signed
        k += 1
      }
      adjust[i] += signedFull - acc
    }
  }

  return adjust
}

/**
 * Builds the anchored series for the real transactions and derives the
 * split-adjusted series as `balance - split adjustment`.
 *
 * The real series is walked backwards from the anchor:
 * `balance(B) = anchor - Σ net(tx) where B < tx.date <= today`, so the last
 * point equals the anchor exactly by construction. The split-adjusted series
 * is the same walk-back minus the per-bucket split accrual adjustment, so
 * the two lines coincide everywhere outside a split's 12-month window and
 * diverge only where a split is being accrued.
 */
function buildAnchoredSeries(
  transactions: Transaction[],
  windowStart: string,
  windowEnd: string,
  anchor: number,
  timeRange: TimeRange
): AnchoredDataPoint[] {
  const realFiltered = filterSeriesTransactions(transactions.map(toSeriesRow))

  const start = getBucketStart(parseUtcDate(windowStart), timeRange)
  const end = getBucketStart(parseUtcDate(windowEnd), timeRange)

  // Full bucket grid from window start to today.
  const bucketKeys: string[] = []
  for (
    let current = new Date(start);
    current.getTime() <= end.getTime();
    current = addBucket(current, timeRange)
  ) {
    bucketKeys.push(getBucketKey(current, timeRange))
  }
  const bucketCount = bucketKeys.length

  const realNet = new Array<number>(bucketCount).fill(0)
  const realIncome = new Array<number>(bucketCount).fill(0)
  const realExpense = new Array<number>(bucketCount).fill(0)
  const realCount = new Array<number>(bucketCount).fill(0)

  for (const tx of realFiltered) {
    const idx = getBucketIndex(new Date(tx.date), start, timeRange)
    if (idx < 0 || idx >= bucketCount) continue

    const amount = getAmount(tx)
    if (tx.type === 'income') {
      realNet[idx] += amount
      realIncome[idx] += amount
    } else {
      realNet[idx] -= amount
      realExpense[idx] += amount
    }
    realCount[idx] += 1
  }

  // Backward walk from the anchor.
  const realBalance = new Array<number>(bucketCount)
  realBalance[bucketCount - 1] = anchor
  for (let i = bucketCount - 2; i >= 0; i -= 1) {
    realBalance[i] = realBalance[i + 1] - realNet[i + 1]
  }

  const adjust = buildSplitAdjustments(
    transactions,
    bucketCount,
    start,
    timeRange,
    new Date()
  )

  return bucketKeys.map((key, i) => ({
    date: key,
    balance: realBalance[i],
    income: realIncome[i],
    expense: realExpense[i],
    transactionCount: realCount[i],
    splitAdjustedBalance:
      Math.abs(adjust[i]) > 0.005 ? realBalance[i] - adjust[i] : null,
  }))
}

function toSeriesRow(tx: Transaction): SeriesRow {
  return {
    date: tx.date,
    type: tx.type,
    eur_amount: tx.eur_amount ?? null,
    split_display_eur_amount: tx.split_display_eur_amount ?? null,
    is_money_transfer: tx.is_money_transfer ?? null,
  }
}

/**
 * Hook to get the balance time series anchored to the Balance card total.
 *
 * Fetches the transactions driving the series and computes two series — the
 * real one (splits booked once at full amount on their source date, like
 * the card) and the split-adjusted one (splits accrued month by month over
 * their rolling 12-month window). The real series is walked backwards from
 * `anchor`, so its last point equals the card's total exactly; the
 * split-adjusted series matches it everywhere outside split windows.
 *
 * @param timeRange - The time window to analyze (`"1m"`, `"1y"`, `"5y"`, or `"all"`).
 * @param anchor - The Balance card total (`useFundCategories().totalBalanceEUR`).
 * @returns An object containing:
 *  - `dataPoints` – The merged `AnchoredDataPoint[]` series.
 *  - `isLoading` – `true` while the fetch is in-flight.
 *  - `error` – The fetch error, or `undefined`.
 */
export function useAnchoredBalanceHistory(
  timeRange: TimeRange,
  anchor: number
) {
  const { data: realRows, error, isLoading } = useSWR<Transaction[]>(
    `anchored-transactions-${timeRange}`,
    (key: string) => anchoredTransactionsFetcher(key, timeRange),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute
      focusThrottleInterval: 300000, // 5 minutes
      refreshInterval: 0,
    }
  )

  const windows = useMemo(() => {
    if (timeRange === '1m') {
      const { current } = getComparisonWindows30()
      return { start: current.start, end: current.end }
    }
    return {
      start: getStartDateForTimeRange(timeRange),
      end: formatUtcDate(new Date()),
    }
  }, [timeRange])

  const dataPoints = useMemo(() => {
    const rows = realRows || []
    const now = new Date()

    const windowStart =
      windows.start ??
      earliestDate(rows.map((t) => t.date)) ??
      formatUtcDate(now)

    return buildAnchoredSeries(
      rows,
      windowStart,
      windows.end,
      anchor,
      timeRange
    )
  }, [realRows, windows, anchor, timeRange])

  return {
    dataPoints,
    isLoading,
    error,
  }
}

/**
 * Shared 30-day comparison windows for the dashboard summary and the
 * balance comparison chart.
 *
 * Both consumers must derive identical SWR cache keys
 * (`range-transactions-{start}:{end}`) so their fetches dedupe instead of
 * overlapping. This is an exact port of the date math formerly inline in
 * `hooks/useDashboardComparison.ts`.
 *
 * @module utils/comparison-windows
 */

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function subDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

/**
 * The three 30-day comparison periods used by the dashboard.
 */
export interface ComparisonWindows {
  /** Last 30 days (including today). */
  current: { start: string; end: string };
  /** The 30 days immediately before the current period. */
  prev: { start: string; end: string };
  /** The same 30-day window one calendar year ago. */
  lastYear: { start: string; end: string };
}

/**
 * Calculates the three 30-day comparison periods ending today.
 *
 * @returns The `current`, `prev`, and `lastYear` windows as YYYY-MM-DD strings.
 */
export function getComparisonWindows30(): ComparisonWindows {
  const today = new Date();
  const currentEnd = today;
  const currentStart = subDays(today, 29); // 29 days ago + today = 30 days

  const prevEnd = subDays(currentStart, 1); // Day before current start
  const prevStart = subDays(prevEnd, 29); // 30 days duration

  const lastYearEnd = new Date(currentEnd);
  lastYearEnd.setFullYear(lastYearEnd.getFullYear() - 1);
  const lastYearStart = new Date(currentStart);
  lastYearStart.setFullYear(lastYearStart.getFullYear() - 1);

  return {
    current: { start: formatDate(currentStart), end: formatDate(currentEnd) },
    prev: { start: formatDate(prevStart), end: formatDate(prevEnd) },
    lastYear: { start: formatDate(lastYearStart), end: formatDate(lastYearEnd) },
  };
}

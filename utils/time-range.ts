/**
 * Time range utilities for data filtering and aggregation.
 *
 * Provides a type definition and helper function for mapping named time ranges
 * (e.g., "1m", "1y") to concrete start dates for database queries.
 *
 * @module utils/time-range
 */

/**
 * Supported time range options for filtering data.
 * - "1m": Last 30 days
 * - "1y": Last 365 days
 * - "5y": Last 5 years
 * - "all": No date limit (returns null)
 */
export type TimeRange = "1m" | "1y" | "5y" | "all"

/**
 * Calculates the start date string for a given time range relative to the current date.
 *
 * @param timeRange - The named time range to convert
 * @returns An ISO date string (YYYY-MM-DD) for the start of the range,
 *          or null for "all" (no start date limit)
 */
export function getStartDateForTimeRange(timeRange: TimeRange): string | null {
  const now = new Date()
  let daysAgo: number

  switch (timeRange) {
    case "1m":
      daysAgo = 30
      break
    case "1y":
      daysAgo = 365
      break
    case "5y":
      daysAgo = 5 * 365
      break
    case "all":
      return null
  }

  const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
  return startDate.toISOString().split("T")[0]
}

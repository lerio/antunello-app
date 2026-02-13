export type TimeRange = "1m" | "1y" | "5y" | "all"

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

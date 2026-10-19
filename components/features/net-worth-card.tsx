"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Balance from "@/components/features/balance";
import { PrivacyBlur } from "@/components/ui/privacy-blur";
import { Skeleton } from "@/components/ui/skeleton";
import { useFundCategories } from "@/hooks/useFundCategories";
import { useLastSync, useNetWorthSeries, SeriesBucket } from "@/hooks/useNetWorthSeries";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { formatAmountWithoutSymbol } from "@/utils/format-utils";
import { getStartDateForTimeRange, TimeRange } from "@/utils/time-range";

/** Bucket width per range: enough resolution to read the shape, no more. */
const BUCKET_BY_RANGE: Record<TimeRange, SeriesBucket> = {
  "1m": "day",
  "1y": "week",
  "5y": "month",
  all: "month",
};

/** `€1.234,56` — matches the rest of the app. */
function eur(amount: number): string {
  return `€${formatAmountWithoutSymbol(Math.abs(amount))}`;
}

function signedEur(amount: number): string {
  return `${amount < 0 ? "-" : "+"}${eur(amount)}`;
}

/** Parses `YYYY-MM-DD` without timezone drift. */
function parseDay(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** `3 October`, from a `YYYY-MM-DD` string. */
function formatDay(iso: string): string {
  return parseDay(iso).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function tickFormatter(timeRange: TimeRange) {
  const options: Intl.DateTimeFormatOptions =
    timeRange === "1m"
      ? { month: "short", day: "numeric", timeZone: "UTC" }
      : timeRange === "1y"
        ? { month: "short", timeZone: "UTC" }
        : { month: "short", year: "2-digit", timeZone: "UTC" };
  return (iso: string) => parseDay(iso).toLocaleDateString("en-US", options);
}

function compactAmount(value: number): string {
  return Math.abs(value) >= 10000 ? `${Math.round(value / 1000)}k` : value.toFixed(0);
}

/** First day of the current local month, as `YYYY-MM-DD`. */
function currentMonthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Home's position block: what everything is worth, how it moved this month,
 * how fresh the figure is, and the trend it sits on.
 *
 * The chart is anchored to the fund total, so its last point is exactly the
 * number printed above it. The funds breakdown lives behind the chevron.
 */
export default function NetWorthCard() {
  const [timeRange, setTimeRange] = useState<TimeRange>("1y");
  const [showFunds, setShowFunds] = useState(false);
  const { privacyMode } = usePrivacyMode();

  const { totalBalanceEUR, isLoading: fundsLoading } = useFundCategories();
  const { lastSync } = useLastSync();

  const { buckets, isLoading: seriesLoading, error } = useNetWorthSeries(
    getStartDateForTimeRange(timeRange),
    BUCKET_BY_RANGE[timeRange]
  );

  // The month's change: one row, asked for separately because the display
  // range's buckets don't necessarily align with calendar months.
  const { buckets: monthBuckets } = useNetWorthSeries(currentMonthStart(), "month");
  const monthDelta = monthBuckets.length > 0 ? monthBuckets[0].delta : null;

  // Walk backwards from the fund total so the series ends on it exactly.
  const series = useMemo(() => {
    const points: { date: string; balance: number }[] = [];
    let running = totalBalanceEUR;
    for (let i = buckets.length - 1; i >= 0; i -= 1) {
      points[i] = { date: buckets[i].date, balance: running };
      running -= buckets[i].delta;
    }
    return points;
  }, [buckets, totalBalanceEUR]);

  const isLoading = fundsLoading || seriesLoading;

  return (
    <div className="bg-white dark:bg-gray-800 text-card-foreground rounded-xl border shadow-sm p-4 mb-2">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold m-0">Net worth</h3>
        <button
          onClick={() => setShowFunds((open) => !open)}
          className="p-1 hover:bg-accent hover:text-accent-foreground rounded transition-colors"
          aria-label={showFunds ? "Hide funds" : "Show funds"}
          aria-expanded={showFunds}
        >
          {showFunds ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </div>

      {fundsLoading ? (
        <div className="mt-3">
          <Skeleton className="h-8 w-40" />
        </div>
      ) : (
        <div className="mt-1 flex items-baseline gap-3">
          <span className="text-2xl font-semibold">
            <PrivacyBlur blur={privacyMode}>{eur(totalBalanceEUR)}</PrivacyBlur>
          </span>
          {monthDelta !== null && (
            <span
              className={`text-sm ${
                monthDelta >= 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              <PrivacyBlur blur={privacyMode}>
                {signedEur(monthDelta)} this month
              </PrivacyBlur>
            </span>
          )}
        </div>
      )}

      {lastSync && (
        <p className="mt-1 text-xs text-muted-foreground">
          as of {formatDay(lastSync)}
        </p>
      )}

      {error ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Couldn&apos;t load the trend.
        </p>
      ) : isLoading ? (
        <Skeleton className="mt-4 h-60 w-full" />
      ) : series.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No history in this range yet.
        </p>
      ) : (
        <>
          {/* Blur applied to the wrapper: the chart is a block, and this is the
              same 6px treatment PrivacyBlur gives the numbers. */}
          <div
            className="mt-4"
            aria-hidden={privacyMode || undefined}
            style={
              privacyMode
                ? { filter: "blur(6px)", WebkitFilter: "blur(6px)" }
                : undefined
            }
          >
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={tickFormatter(timeRange)}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tickFormatter={compactAmount}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0].payload as { date: string; balance: number };
                    return (
                      <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-sm">
                        <div className="font-medium">{formatDay(point.date)}</div>
                        <div className="text-muted-foreground">
                          {eur(point.balance)}
                        </div>
                      </div>
                    );
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke="hsl(var(--foreground))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 flex gap-2">
            {(["1m", "1y", "5y", "all"] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                  timeRange === range
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                {range === "all" ? "All" : range.toUpperCase()}
              </button>
            ))}
          </div>
        </>
      )}

      {showFunds && (
        <div className="mt-4">
          <Balance embedded />
        </div>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  Area,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PrivacyBlur } from "@/components/ui/privacy-blur";
import { Skeleton } from "@/components/ui/skeleton";
import { useFundCategories } from "@/hooks/useFundCategories";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useNetWorthSeries, SeriesBucket } from "@/hooks/useNetWorthSeries";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { formatCurrency } from "@/utils/currency";
import { getStartDateForTimeRange, TimeRange } from "@/utils/time-range";

/** Bucket width per range: enough resolution to read the shape, no more. */
const BUCKET_BY_RANGE: Record<TimeRange, SeriesBucket> = {
  "1m": "day",
  "1y": "week",
  "5y": "month",
  all: "month",
};

/** Spoken labels for the range pills, whose visible text is abbreviated. */
const RANGE_LABELS: Record<TimeRange, string> = {
  "1m": "One month",
  "1y": "One year",
  "5y": "Five years",
  all: "All time",
};

/** `1.234,56 €` — the app's single currency formatter, never hand-prefixed. */
function eur(amount: number): string {
  return formatCurrency(Math.abs(amount), "EUR");
}

/** Parses `YYYY-MM-DD` without timezone drift. */
function parseDay(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** `3 Oct`, from a `YYYY-MM-DD` string. */
function formatDay(iso: string): string {
  return parseDay(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** Today, in the same `20 Oct` shape as the "as of" caption. */
function todayLabel(): string {
  return new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function tickFormatter(timeRange: TimeRange) {
  const options: Intl.DateTimeFormatOptions =
    timeRange === "1m"
      ? { month: "short", day: "numeric", timeZone: "UTC" }
      : timeRange === "1y"
        ? { month: "short", timeZone: "UTC" }
        : { year: "numeric", timeZone: "UTC" };
  return (iso: string) => parseDay(iso).toLocaleDateString("en-GB", options);
}

/**
 * X values worth labelling: weekly for a month, one per month for a year, and
 * one per year beyond that.
 *
 * Ticks are thinned here rather than by Recharts, so a narrow chart drops every
 * second label instead of an irregular subset.
 */
function xTicksFor(
  points: readonly { date: string }[],
  timeRange: TimeRange,
  isDesktop: boolean
): string[] {
  if (timeRange === "1m") {
    return points.filter((_, index) => index % 7 === 0).map((point) => point.date);
  }

  const keyLength = timeRange === "1y" ? 7 : 4;
  const ticks: string[] = [];
  let previous = "";

  for (const point of points) {
    const key = point.date.slice(0, keyLength);
    if (key !== previous) {
      ticks.push(point.date);
      previous = key;
    }
  }

  const step =
    timeRange === "1y"
      ? isDesktop
        ? 1
        : 2
      : Math.ceil(ticks.length / (isDesktop ? 8 : 6));

  return step > 1 ? ticks.filter((_, index) => index % step === 0) : ticks;
}

/** Rounded axis ticks, so the y-axis reads 95k/100k rather than 98.4k. */
function niceTicks(min: number, max: number, count = 3): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) return [min];

  const rawStep = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const residual = rawStep / magnitude;
  let step =
    (residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 2.5 ? 2.5 : residual <= 5 ? 5 : 10) *
    magnitude;

  // Rounding out to whole steps can add an extra tick at each end. Widen the
  // step until the axis has at most `count + 1` lines.
  for (;;) {
    const start = Math.floor(min / step) * step;
    const end = Math.ceil(max / step) * step;
    const ticks: number[] = [];
    for (let value = start; value <= end + step / 2; value += step) {
      ticks.push(Number(value.toFixed(6)));
    }
    if (ticks.length <= count + 1) return ticks;
    step *= 2;
  }
}

function compactAmount(value: number): string {
  return Math.abs(value) >= 10000 ? `${Math.round(value / 1000)}k` : value.toFixed(0);
}

/**
 * Home's position block: what everything is worth, how it moved this month,
 * how fresh the figure is, and the trend it sits on.
 *
 * The chart is anchored to the fund total, so its last point is exactly the
 * number printed above it.
 */
export default function NetWorthCard() {
  const [timeRange, setTimeRange] = useState<TimeRange>("1y");
  const isDesktop = useIsDesktop();
  const [chartPreference, setChartPreference] = useState<boolean | null>(null);
  const chartOpen = chartPreference ?? isDesktop;
  const { privacyMode } = usePrivacyMode();

  const { totalBalanceEUR, isLoading: fundsLoading } = useFundCategories();

  const { buckets, isLoading: seriesLoading, error } = useNetWorthSeries(
    getStartDateForTimeRange(timeRange),
    BUCKET_BY_RANGE[timeRange]
  );

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

  const xTicks = useMemo(
    () => xTicksFor(series, timeRange, isDesktop),
    [series, timeRange, isDesktop]
  );
  const yTicks = useMemo(() => {
    if (series.length === 0) return [];
    const balances = series.map((point) => point.balance);
    return niceTicks(Math.min(...balances), Math.max(...balances));
  }, [series]);

  const isLoading = fundsLoading || seriesLoading;

  return (
    <div className="bg-white dark:bg-gray-800 text-card-foreground rounded-2xl border shadow-sm p-4 sm:p-6 tabular-nums">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold m-0">Net worth</h3>
        <button
          onClick={() => setChartPreference(!chartOpen)}
          className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
          aria-label={chartOpen ? "Hide chart" : "Show chart"}
          aria-expanded={chartOpen}
        >
          {chartOpen ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </div>

      {fundsLoading ? (
        <div className="mt-3">
          <Skeleton className="h-8 w-40" />
        </div>
      ) : (
        <div className="mt-1">
          <span className="text-3xl font-semibold">
            <PrivacyBlur blur={privacyMode}>{eur(totalBalanceEUR)}</PrivacyBlur>
          </span>
        </div>
      )}

      <p className="mt-1 text-xs text-muted-foreground">
        as of {todayLabel()}
      </p>

      {chartOpen && (error ? (
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
          <div className="mt-3 flex gap-2" role="group" aria-label="Chart range">
            {(["1m", "1y", "5y", "all"] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                aria-pressed={timeRange === range}
                aria-label={RANGE_LABELS[range]}
                className={`min-h-11 rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  timeRange === range
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                {range === "all" ? "All" : range.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Blur applied to the wrapper: the chart is a block, and this is the
              same 6px treatment PrivacyBlur gives the numbers. */}
          <div
            className="mt-4"
            role="img"
            aria-label={`Net worth trend, ${RANGE_LABELS[timeRange]}. Latest ${eur(
              series[series.length - 1].balance,
            )}.`}
            aria-hidden={privacyMode || undefined}
            style={
              privacyMode
                ? { filter: "blur(6px)", WebkitFilter: "blur(6px)" }
                : undefined
            }
          >
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="hsl(var(--foreground))"
                      stopOpacity={0.08}
                    />
                    <stop
                      offset="100%"
                      stopColor="hsl(var(--foreground))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="hsl(var(--border))"
                  strokeDasharray="2 4"
                  opacity={0.6}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  ticks={xTicks}
                  interval={0}
                  tickFormatter={tickFormatter(timeRange)}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={compactAmount}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  domain={
                    yTicks.length > 1
                      ? [yTicks[0], yTicks[yTicks.length - 1]]
                      : ["auto", "auto"]
                  }
                  ticks={yTicks.length > 1 ? yTicks : undefined}
                  allowDataOverflow={false}
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
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="none"
                  fill="url(#netWorthFill)"
                  baseValue={yTicks[0] ?? 0}
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke="hsl(var(--foreground))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <ReferenceDot
                  x={series[series.length - 1].date}
                  y={series[series.length - 1].balance}
                  r={3}
                  fill="hsl(var(--foreground))"
                  stroke="none"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      ))}
    </div>
  );
}

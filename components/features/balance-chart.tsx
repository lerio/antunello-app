"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  useBalanceHistory,
  TimeRange,
  BalanceDataPoint,
} from "@/hooks/useBalanceHistory";
import { formatCurrency } from "@/utils/currency";
import { ChartSkeleton } from "@/components/ui/skeletons";

/**
 * Custom tooltip props interface for recharts
 */
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: BalanceDataPoint;
    value: number;
  }>;
}

/**
 * Format date for axis display based on time range
 */
function formatDateAxis(dateStr: string, timeRange: TimeRange): string {
  const date = new Date(dateStr);

  if (timeRange === "1m") {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (timeRange === "1y") {
    return date.toLocaleDateString("en-US", { month: "short" });
  }
  return date.toLocaleDateString("en-US", { year: "2-digit", month: "short" });
}

/**
 * Format currency for axis display (compact format)
 */
function formatCurrencyAxis(value: number): string {
  if (Math.abs(value) >= 10000) {
    return `${(value / 1000).toFixed(0)}k`;
  }
  return value.toFixed(0);
}

/**
 * Format date for tooltip display
 */
function formatDateTooltip(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Custom tooltip component
 */
function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0].payload;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg">
      <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">
        {formatDateTooltip(data.date)}
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between items-center gap-4">
          <span className="text-gray-600 dark:text-gray-400">Balance:</span>
          <span
            className={`font-semibold ${
              data.balance >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {formatCurrency(data.balance, "EUR")}
          </span>
        </div>
        {data.income > 0 && (
          <div className="flex justify-between items-center gap-4">
            <span className="text-gray-600 dark:text-gray-400">Income:</span>
            <span className="font-medium text-green-600 dark:text-green-400">
              +{formatCurrency(data.income, "EUR")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Time range button component
 */
function TimeRangeButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg font-medium text-sm transition-all ${
        selected
          ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
          : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
      }`}
    >
      {label}
    </button>
  );
}

/**
 * Balance chart controls (time range)
 */
function BalanceChartControls({
  timeRange,
  onTimeRangeChange,
}: {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <div className="flex gap-2">
        <TimeRangeButton
          label="1M"
          selected={timeRange === "1m"}
          onClick={() => onTimeRangeChange("1m")}
        />
        <TimeRangeButton
          label="1Y"
          selected={timeRange === "1y"}
          onClick={() => onTimeRangeChange("1y")}
        />
        <TimeRangeButton
          label="5Y"
          selected={timeRange === "5y"}
          onClick={() => onTimeRangeChange("5y")}
        />
        <TimeRangeButton
          label="All"
          selected={timeRange === "all"}
          onClick={() => onTimeRangeChange("all")}
        />
      </div>
    </div>
  );
}


/**
 * Empty state when no data is available
 */
function EmptyState() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 text-center">
      <p className="text-gray-500 dark:text-gray-400 mb-2">
        No transaction data available
      </p>
    </div>
  );
}

/**
 * Main balance chart component
 */
export default function BalanceChart() {
  const [timeRange, setTimeRange] = useState<TimeRange>("1m");
  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const { dataPoints, isLoading } = useBalanceHistory(timeRange, true);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (isLoading) {
    return <ChartSkeleton />;
  }

  if (dataPoints.length === 0) {
    return <EmptyState />;
  }

  // Calculate min and max balance for Y-axis domain
  const balances = dataPoints.map((d) => d.balance);
  const minBalance = Math.min(...balances);
  const maxBalance = Math.max(...balances);

  // Add 5% padding to the domain
  const padding =
    (maxBalance - minBalance) * 0.05 || Math.abs(minBalance) * 0.1 || 100;
  const yAxisDomain = [minBalance - padding, maxBalance + padding];

  // Calculate X-axis tick interval based on screen size and time range
  const getXAxisInterval = () => {
    if (!isMobile) return "preserveStartEnd";

    // Mobile: reduce ticks based on time range
    const dataLength = dataPoints.length;
    if (timeRange === "1m") return Math.floor(dataLength / 4); // Show ~5 ticks
    if (timeRange === "1y") return Math.floor(dataLength / 5); // Show ~6 ticks
    if (timeRange === "5y") return Math.floor(dataLength / 4); // Show ~5 ticks
    return Math.floor(dataLength / 4); // Show ~5 ticks for 'all'
  };

  const xAxisInterval = getXAxisInterval();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 sm:p-6">
      <BalanceChartControls
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
      />

      <div
        className="h-[250px] md:h-[350px] mt-4"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <ResponsiveContainer width="100%" height={isMobile ? 250 : 350}>
          <LineChart
            data={dataPoints}
            margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              opacity={0.3}
            />

            <XAxis
              dataKey="date"
              tickFormatter={(date) => formatDateAxis(date, timeRange)}
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              interval={xAxisInterval}
              style={{
                opacity: isHovered ? 1 : 0.3,
                transition: "opacity 200ms",
              }}
            />

            <YAxis
              domain={yAxisDomain}
              tickFormatter={formatCurrencyAxis}
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              width={60}
              style={{
                opacity: isHovered ? 1 : 0.3,
                transition: "opacity 200ms",
              }}
            />

            <Tooltip content={<CustomTooltip />} />

            <ReferenceLine
              y={0}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="3 3"
              opacity={0.5}
            />

            <Line
              type="monotone"
              dataKey="balance"
              stroke="hsl(var(--foreground))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

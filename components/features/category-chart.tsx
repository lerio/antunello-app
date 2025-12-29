"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  useCategoryHistory,
  TimeRange,
  CategoryDataPoint,
} from "@/hooks/useCategoryHistory";
import { formatCurrency } from "@/utils/currency";
import { ChartSkeleton } from "@/components/ui/skeletons";
import { getCategoryType } from "@/types/database";

/**
 * Custom tooltip props interface for recharts
 */
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: CategoryDataPoint;
    value: number;
  }>;
  timeRange: TimeRange;
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
  // 5y and all show years
  return date.toLocaleDateString("en-US", { year: "numeric" });
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
 * Format date for tooltip display based on time range
 */
function formatDateTooltip(dateStr: string, timeRange: TimeRange): string {
  const date = new Date(dateStr);

  if (timeRange === "1m") {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  if (timeRange === "1y") {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
    });
  }
  // 5y and all show years
  return date.toLocaleDateString("en-US", { year: "numeric" });
}

/**
 * Custom tooltip component
 */
function CustomTooltip({ active, payload, timeRange }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0].payload;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg">
      <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">
        {formatDateTooltip(data.date, timeRange)}
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between items-center gap-4">
          <span className="text-gray-600 dark:text-gray-400">Amount:</span>
          <span className="font-semibold text-red-600 dark:text-red-400">
            {formatCurrency(data.amount, "EUR")}
          </span>
        </div>
        <div className="flex justify-between items-center gap-4">
          <span className="text-gray-600 dark:text-gray-400">Transactions:</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {data.transactionCount}
          </span>
        </div>
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
      className={`px-3 py-1.5 rounded-lg font-medium text-sm transition-all ${selected
        ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
        : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
        }`}
    >
      {label}
    </button>
  );
}

/**
 * Chart controls with time range and total summary
 */
function CategoryChartControls({
  timeRange,
  onTimeRangeChange,
  totalAmount,
  totalTransactions,
  totalColorClass,
}: {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  totalAmount: number;
  totalTransactions: number;
  totalColorClass: string;
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

      {/* Total summary */}
      <div className="text-right">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {totalTransactions} transaction{totalTransactions !== 1 ? "s" : ""}
        </div>
        <div className={`font-semibold ${totalColorClass}`}>
          {formatCurrency(totalAmount, "EUR")}
        </div>
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
        No transaction data available for this category
      </p>
    </div>
  );
}

/**
 * Main category chart component
 */
export default function CategoryChart({
  category,
  subCategory,
  timeRange,
  onTimeRangeChange,
}: {
  category: string;
  subCategory?: string;
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const { dataPoints, totalAmount, totalTransactions, isLoading } =
    useCategoryHistory(timeRange, category, subCategory);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const categoryType = getCategoryType(category);
  const isMoneyTransfer = category === "Money Transfer";

  let totalColorClass = "text-red-600 dark:text-red-400"; // Default expense
  if (isMoneyTransfer) {
    totalColorClass = "text-gray-900 dark:text-white";
  } else if (categoryType === "income") {
    totalColorClass = "text-green-600 dark:text-green-400";
  }

  if (isLoading) {
    return <ChartSkeleton />;
  }

  if (dataPoints.length === 0) {
    return <EmptyState />;
  }

  // Calculate max amount for Y-axis domain
  const amounts = dataPoints.map((d) => d.amount);
  const maxAmount = Math.max(...amounts);

  // Add 10% padding to the domain
  const padding = maxAmount * 0.1 || 100;
  const yAxisDomain = [0, maxAmount + padding];

  // Calculate X-axis tick interval based on screen size and time range
  const getXAxisInterval = () => {
    if (!isMobile) return "preserveStartEnd";

    // Mobile: reduce ticks based on data length
    const dataLength = dataPoints.length;
    if (dataLength <= 6) return 0; // Show all ticks
    if (timeRange === "1m") return Math.floor(dataLength / 4); // Show ~5 ticks
    if (timeRange === "1y") return Math.floor(dataLength / 5); // Show ~6 ticks
    return Math.floor(dataLength / 4); // Show ~5 ticks
  };

  const xAxisInterval = getXAxisInterval();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 sm:p-6">
      <CategoryChartControls
        timeRange={timeRange}
        onTimeRangeChange={onTimeRangeChange}
        totalAmount={totalAmount}
        totalTransactions={totalTransactions}
        totalColorClass={totalColorClass}
      />

      <div
        className="h-[250px] md:h-[350px] mt-4 [&_*]:outline-none"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <ResponsiveContainer width="100%" height={isMobile ? 250 : 350}>
          <BarChart
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

            <Tooltip
              content={<CustomTooltip timeRange={timeRange} />}
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
            />

            <Bar
              dataKey="amount"
              fill="hsl(var(--foreground))"
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

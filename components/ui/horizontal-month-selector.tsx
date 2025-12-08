import React, { useEffect, useRef } from "react";
import { MonthOption } from "@/hooks/useAvailableMonths";

function getMonthButtonVariant(
  isSelected: boolean,
  isToday: boolean,
  isFuture: boolean
): string {
  if (isSelected) {
    return "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 scale-105 shadow-md";
  }
  if (isToday) {
    return "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50";
  }
  if (isFuture) {
    return "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700";
  }
  return "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-sm";
}

interface HorizontalMonthSelectorProps {
  readonly months: ReadonlyArray<MonthOption>;
  readonly selectedMonth: Readonly<{ year: number; month: number }>;
  readonly onMonthSelect: (year: number, month: number) => void;
  readonly className?: string;
}

export function HorizontalMonthSelector({
  months,
  selectedMonth,
  onMonthSelect,
  className = "",
}: HorizontalMonthSelectorProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const isInitialMount = useRef(true);
  const prevMonthsRef = useRef(months);

  // Center the selected month
  useEffect(() => {
    if (selectedRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const selectedElement = selectedRef.current;

      const containerWidth = container.clientWidth;
      const elementLeft = selectedElement.offsetLeft;
      const elementWidth = selectedElement.clientWidth;

      // Calculate scroll position to center the element
      const scrollLeft = elementLeft - containerWidth / 2 + elementWidth / 2;

      let behavior: ScrollBehavior = "smooth";

      // Use instant scroll on initial mount or if the 'months' data itself has changed.
      if (isInitialMount.current || prevMonthsRef.current !== months) {
        behavior = "auto";
      }

      container.scrollTo({
        left: scrollLeft,
        behavior,
      });

      // Update refs for the next render cycle
      isInitialMount.current = false;
      prevMonthsRef.current = months;
    }
  }, [selectedMonth.year, selectedMonth.month, months]); // Depend on specific properties and months array

  return (
    <div className={`relative ${className}`}>
      {/* Scrollable months container */}
      <div
        ref={scrollContainerRef}
        className="flex gap-2 overflow-x-auto px-4 [&::-webkit-scrollbar]:hidden"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          touchAction: "pan-x",
          overscrollBehaviorY: "none",
        }}
      >
        {months.map((month) => {
          const isSelected =
            month.year === selectedMonth.year &&
            month.month === selectedMonth.month;

          return (
            <button
              key={`${month.year}-${month.month}`}
              ref={isSelected ? selectedRef : undefined}
              onClick={() => onMonthSelect(month.year, month.month)}
              className={`
                flex-shrink-0 px-5 py-1 rounded-lg font-medium text-sm transition-all duration-200
                ${getMonthButtonVariant(
                  isSelected,
                  month.isToday,
                  month.isFuture
                )}
              `}
            >
              <div className="text-center min-w-[70px]">
                <div className="font-semibold whitespace-nowrap">
                  {month.date.toLocaleDateString("en-US", { month: "long" })}
                </div>
                {month.year !== new Date().getFullYear() && (
                  <div
                    className={`text-xs mt-0.5 ${
                      isSelected
                        ? "text-white/80 dark:text-gray-900/80"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {month.year}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

import React, { useEffect, useRef } from "react";

function getYearButtonVariant(isSelected: boolean, isToday: boolean, isFuture: boolean): string {
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

export interface YearOption {
  year: number;
  isToday: boolean;
  isFuture: boolean;
}

interface HorizontalYearSelectorProps {
  readonly years: ReadonlyArray<YearOption>;
  readonly selectedYear: number;
  readonly onYearSelect: (year: number) => void;
  readonly className?: string;
}

export function HorizontalYearSelector({
  years,
  selectedYear,
  onYearSelect,
  className = "",
}: HorizontalYearSelectorProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const isInitialMount = useRef(true);
  const prevYearsRef = useRef(years);

  // Center the selected year
  useEffect(() => {
    if (selectedRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const selectedElement = selectedRef.current;

      const containerWidth = container.clientWidth;
      const elementLeft = selectedElement.offsetLeft;
      const elementWidth = selectedElement.clientWidth;

      // Calculate scroll position to center the element
      const scrollLeft = elementLeft - (containerWidth / 2) + (elementWidth / 2);

      let behavior: ScrollBehavior = "smooth";

      // Use instant scroll on initial mount or if the 'years' data itself has changed.
      if (isInitialMount.current || prevYearsRef.current !== years) {
        behavior = "auto";
      }

      container.scrollTo({
        left: scrollLeft,
        behavior
      });

      // Update refs
      isInitialMount.current = false;
      prevYearsRef.current = years;
    }
  }, [selectedYear, years]);

  return (
    <div className={`relative ${className}`}>
      {/* Scrollable years container */}
      <div
        ref={scrollContainerRef}
        className="flex gap-2 overflow-x-auto px-4 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {years.map((yearOption) => {
          const isSelected = yearOption.year === selectedYear;

          return (
            <button
              key={yearOption.year}
              ref={isSelected ? selectedRef : undefined}
              onClick={() => onYearSelect(yearOption.year)}
              className={`
                flex-shrink-0 px-6 py-2 rounded-lg font-medium text-sm transition-all duration-200
                ${getYearButtonVariant(isSelected, yearOption.isToday, yearOption.isFuture)}
              `}
            >
              <div className="text-center min-w-[60px]">
                <div className="font-semibold">{yearOption.year}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

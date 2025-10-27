import React, { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from './horizontal-year-selector.module.css'

function getYearButtonVariant(isSelected: boolean, isToday: boolean, isFuture: boolean): string {
  if (isSelected) {
    return "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 shadow-lg scale-105";
  }
  if (isToday) {
    return "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50";
  }
  if (isFuture) {
    return "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700";
  }
  return "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-md";
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

  // Determine if we should show navigation arrows based on selected year
  const today = new Date();
  const currentYear = today.getFullYear();
  const isCurrentYearSelected = selectedYear === currentYear;
  const isInFuture = selectedYear > currentYear;
  const isInPast = selectedYear < currentYear;

  // Center the selected year with smooth animation after DOM updates
  useEffect(() => {
    if (selectedRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const selectedElement = selectedRef.current;

      // Use setTimeout to delay centering until after React has completed DOM updates
      const timeoutId = setTimeout(() => {
        const containerWidth = container.clientWidth;
        const elementLeft = selectedElement.offsetLeft;
        const elementWidth = selectedElement.clientWidth;

        // Calculate scroll position to center the element
        const scrollLeft = elementLeft - containerWidth / 2 + elementWidth / 2;

        // Use smooth scrolling animation
        container.scrollTo({
          left: scrollLeft,
          behavior: 'smooth'
        });
      }, 50); // Small delay to allow DOM updates to complete
      
      return () => clearTimeout(timeoutId);
    }
  }, [selectedYear]);


  const navigateToCurrentYear = () => {
    const today = new Date();
    onYearSelect(today.getFullYear());
  };

  return (
    <div className={`relative ${className}`}>
      {/* Left arrow - Return to current year (when browsing future) */}
      {!isCurrentYearSelected && isInFuture && (
        <div className="absolute left-0 top-0 bottom-0 z-20 flex items-center">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-50 dark:from-gray-900 via-gray-50/80 dark:via-gray-900/80 to-transparent w-12 pointer-events-none" />
          <button
            onClick={navigateToCurrentYear}
            className="p-1.5 rounded-full bg-white dark:bg-gray-800 shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-gray-300 dark:border-gray-600 relative z-10"
            aria-label="Return to current year"
            title="Return to current year"
          >
            <ChevronLeft
              size={16}
              className="text-gray-700 dark:text-gray-300"
            />
          </button>
        </div>
      )}

      {/* Right arrow - Return to current year (when browsing past) */}
      {!isCurrentYearSelected && isInPast && (
        <div className="absolute right-0 top-0 bottom-0 z-20 flex items-center justify-end">
          <div className="absolute inset-0 bg-gradient-to-l from-gray-50 dark:from-gray-900 via-gray-50/80 dark:via-gray-900/80 to-transparent w-12 pointer-events-none" />
          <button
            onClick={navigateToCurrentYear}
            className="p-1.5 rounded-full bg-white dark:bg-gray-800 shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-gray-300 dark:border-gray-600 relative z-10"
            aria-label="Return to current year"
            title="Return to current year"
          >
            <ChevronRight
              size={16}
              className="text-gray-700 dark:text-gray-300"
            />
          </button>
        </div>
      )}

      {/* Scrollable years container */}
      <div
        ref={scrollContainerRef}
        className={`flex gap-2 overflow-x-auto ${styles.scrollbarHide} pt-1 pb-5 px-8`}
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
                flex-shrink-0 px-4 py-3.5 rounded-lg font-medium text-sm transition-all transform
                ${getYearButtonVariant(isSelected, yearOption.isToday, yearOption.isFuture)}
                ${isSelected ? "hover:scale-105" : "hover:scale-102"}
              `}
            >
              <div className="text-center min-w-[80px]">
                <div className="font-semibold">{yearOption.year}</div>
              </div>
            </button>
          );
        })}
      </div>

    </div>
  );
}

import { useEffect, useRef } from "react";

function getYearButtonVariant(
  isSelected: boolean,
  isToday: boolean,
  isFuture: boolean,
): string {
  if (isSelected) {
    return "bg-foreground text-background shadow-sm";
  }
  if (isToday) {
    return "text-foreground";
  }
  if (isFuture) {
    return "text-muted-foreground";
  }
  return "text-foreground";
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
      const scrollLeft = elementLeft - containerWidth / 2 + elementWidth / 2;

      let behavior: ScrollBehavior = "smooth";

      // Use instant scroll on initial mount or if the 'years' data itself has changed.
      if (isInitialMount.current || prevYearsRef.current !== years) {
        behavior = "auto";
      }

      container.scrollTo({
        left: scrollLeft,
        behavior,
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
        className="flex gap-1 overflow-x-auto px-4 py-2 [&::-webkit-scrollbar]:hidden"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          touchAction: "pan-x",
          overscrollBehaviorY: "none",
        }}
      >
        {years.map((yearOption) => {
          const isSelected = yearOption.year === selectedYear;

          return (
            <button
              key={yearOption.year}
              ref={isSelected ? selectedRef : undefined}
              onClick={() => onYearSelect(yearOption.year)}
              className={`
                flex-shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors
                ${getYearButtonVariant(
                  isSelected,
                  yearOption.isToday,
                  yearOption.isFuture,
                )}
              `}
            >
              {yearOption.year}
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { Fragment, useEffect, useRef } from "react";
import { MonthOption } from "@/hooks/useAvailableMonths";

interface HorizontalMonthSelectorProps {
  readonly months: ReadonlyArray<MonthOption>;
  readonly selectedMonth: Readonly<{ year: number; month: number }>;
  readonly onMonthSelect: (year: number, month: number) => void;
  readonly className?: string;
}

const FADE_MASK =
  "linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)";

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

      const scrollLeft = elementLeft - containerWidth / 2 + elementWidth / 2;

      let behavior: ScrollBehavior = "smooth";
      if (isInitialMount.current || prevMonthsRef.current !== months) {
        behavior = "auto";
      }

      container.scrollTo({ left: scrollLeft, behavior });

      isInitialMount.current = false;
      prevMonthsRef.current = months;
    }
  }, [selectedMonth.year, selectedMonth.month, months]);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={scrollContainerRef}
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto py-2 [&::-webkit-scrollbar]:hidden"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          touchAction: "pan-x",
          overscrollBehaviorY: "none",
          maskImage: FADE_MASK,
          WebkitMaskImage: FADE_MASK,
        }}
      >
        {months.map((month, index) => {
          const previous = months[index - 1];
          const showYearMarker = previous !== undefined && previous.year !== month.year;
          const isSelected =
            month.year === selectedMonth.year &&
            month.month === selectedMonth.month;
          // en-GB renders September as "Sept"; keep every chip three letters.
          const label = month.date
            .toLocaleDateString("en-GB", { month: "short" })
            .slice(0, 3);

          return (
            <Fragment key={`${month.year}-${month.month}`}>
              {showYearMarker && (
                <span className="flex h-9 flex-shrink-0 items-center px-1 text-xs font-semibold text-muted-foreground">
                  {month.year}
                </span>
              )}
              <button
                ref={isSelected ? selectedRef : undefined}
                onClick={() => onMonthSelect(month.year, month.month)}
                aria-current={isSelected ? "true" : undefined}
                aria-label={`${month.date.toLocaleDateString("en-GB", {
                  month: "long",
                  year: "numeric",
                })}${isSelected ? ", selected" : ""}`}
                className={`relative flex h-9 flex-shrink-0 snap-center items-center justify-center rounded-full px-3 text-sm font-medium transition-colors ${
                  isSelected
                    ? "bg-foreground text-background shadow-sm"
                    : month.isFuture
                      ? "text-muted-foreground hover:bg-accent"
                      : "text-foreground hover:bg-accent"
                }`}
              >
                {label}
                {month.isToday && (
                  <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-current opacity-60" />
                )}
              </button>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

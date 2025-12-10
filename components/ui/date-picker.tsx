"use client";

import * as React from "react";
import { format, setHours, setMinutes } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

// Simple calendar component for date-only picker
function SimpleDateCalendar({
  selected,
  onSelect,
}: {
  selected: Date | undefined;
  onSelect: (date: Date) => void;
}) {
  const [viewDate, setViewDate] = React.useState(selected || new Date());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startDay = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  const days: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const isSelected = (day: number) => {
    if (!selected) return false;
    return (
      selected.getDate() === day &&
      selected.getMonth() === month &&
      selected.getFullYear() === year
    );
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === month &&
      today.getFullYear() === year
    );
  };

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={prevMonth}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {format(viewDate, "MMMM yyyy")}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={nextMonth}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
          <div
            key={day}
            className="text-xs font-medium text-muted-foreground h-8 flex items-center justify-center"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => (
          <div key={idx} className="flex items-center justify-center">
            {day ? (
              <button
                type="button"
                onClick={() => onSelect(new Date(year, month, day))}
                className={cn(
                  "h-8 w-8 rounded-md text-sm font-normal transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                  isSelected(day) &&
                    "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                  isToday(day) && !isSelected(day) && "bg-accent text-accent-foreground"
                )}
              >
                {day}
              </button>
            ) : (
              <div className="h-8 w-8" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DatePicker({
  date,
  onDateChange,
  disabled = false,
  className,
  placeholder = "Pick a date",
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (selectedDate: Date) => {
    onDateChange(selectedDate);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal h-12",
            !date && "text-muted-foreground",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 max-w-[calc(100vw-2rem)] mx-auto" align="center">
        <SimpleDateCalendar selected={date} onSelect={handleSelect} />
      </PopoverContent>
    </Popover>
  );
}

interface DateTimePickerProps {
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

// Generate time slots in 15-minute intervals
const TIME_SLOTS: { hour: number; minute: number; label: string }[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    TIME_SLOTS.push({
      hour: h,
      minute: m,
      label: `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`,
    });
  }
}

export function DateTimePicker({
  date,
  onDateChange,
  disabled = false,
  className,
  placeholder = "Pick date and time",
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [viewDate, setViewDate] = React.useState(date || new Date());
  const timeListRef = React.useRef<HTMLDivElement>(null);

  // Update viewDate when date prop changes
  React.useEffect(() => {
    if (date) {
      setViewDate(date);
    }
  }, [date]);

  // Scroll to selected time when popover opens
  React.useEffect(() => {
    if (open) {
      // Small delay to ensure DOM is rendered
      const timer = setTimeout(() => {
        if (!timeListRef.current) return;

        // Use selected date's time, or current time for new transactions
        const targetDate = date || new Date();
        const targetHour = targetDate.getHours();
        const targetMinute = targetDate.getMinutes();

        // Find the closest 15-minute slot
        const roundedMinute = Math.round(targetMinute / 15) * 15;
        const adjustedHour = roundedMinute === 60 ? (targetHour + 1) % 24 : targetHour;
        const adjustedMinute = roundedMinute === 60 ? 0 : roundedMinute;

        const selectedIndex = TIME_SLOTS.findIndex(
          (slot) => slot.hour === adjustedHour && slot.minute === adjustedMinute
        );

        if (selectedIndex >= 0) {
          const itemHeight = 40; // h-10 = 40px
          const containerHeight = 280; // max-h-[280px]
          // Center the selected item in the viewport
          const scrollPosition = (selectedIndex * itemHeight) - (containerHeight / 2) + (itemHeight / 2);
          timeListRef.current.scrollTop = Math.max(0, scrollPosition);
        }
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [open, date]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startDay = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  const days: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const isSelected = (day: number) => {
    if (!date) return false;
    return (
      date.getDate() === day &&
      date.getMonth() === month &&
      date.getFullYear() === year
    );
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === month &&
      today.getFullYear() === year
    );
  };

  const handleDayClick = (day: number) => {
    const hours = date ? date.getHours() : new Date().getHours();
    const minutes = date ? date.getMinutes() : 0;
    // Round minutes to nearest 15
    const roundedMinutes = Math.round(minutes / 15) * 15;
    const newDate = new Date(year, month, day, hours, roundedMinutes === 60 ? 0 : roundedMinutes);
    onDateChange(newDate);
  };

  const handleTimeClick = (hour: number, minute: number) => {
    const currentDate = date || new Date();
    const newDate = setMinutes(setHours(currentDate, hour), minute);
    onDateChange(newDate);
  };

  const isTimeSelected = (hour: number, minute: number) => {
    if (!date) return false;
    // Check exact match first
    if (date.getHours() === hour && date.getMinutes() === minute) {
      return true;
    }
    // For times not on 15-min boundaries, highlight the closest slot
    const currentHour = date.getHours();
    const currentMinute = date.getMinutes();
    const roundedMinute = Math.round(currentMinute / 15) * 15;
    const adjustedHour = roundedMinute === 60 ? (currentHour + 1) % 24 : currentHour;
    const adjustedMinute = roundedMinute === 60 ? 0 : roundedMinute;
    return adjustedHour === hour && adjustedMinute === minute;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal h-12",
            !date && "text-muted-foreground",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "dd/MM/yyyy HH:mm") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 max-w-[calc(100vw-2rem)] mx-auto" align="center">
        <div className="flex">
          {/* Calendar Section */}
          <div className="p-3 border-r border-border">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-4">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={prevMonth}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-semibold">
                {format(viewDate, "MMMM yyyy")}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={nextMonth}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                <div
                  key={day}
                  className="text-xs font-medium text-muted-foreground h-8 flex items-center justify-center"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, idx) => (
                <div key={idx} className="flex items-center justify-center">
                  {day ? (
                    <button
                      type="button"
                      onClick={() => handleDayClick(day)}
                      className={cn(
                        "h-9 w-9 rounded-md text-sm font-normal transition-colors",
                        "hover:bg-accent hover:text-accent-foreground",
                        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                        isSelected(day) &&
                          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                        isToday(day) && !isSelected(day) && "bg-accent text-accent-foreground"
                      )}
                    >
                      {day}
                    </button>
                  ) : (
                    <div className="h-9 w-9" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Time Section */}
          <div className="flex flex-col w-20">
            <div className="p-3 pb-2 border-b border-border">
              <span className="text-sm font-semibold">Time</span>
            </div>
            <div
              ref={timeListRef}
              className="flex-1 overflow-y-auto max-h-[280px]"
            >
              {TIME_SLOTS.map((slot) => (
                <button
                  key={slot.label}
                  type="button"
                  onClick={() => handleTimeClick(slot.hour, slot.minute)}
                  className={cn(
                    "w-full h-10 px-3 text-sm text-center transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus:outline-none focus:bg-accent",
                    isTimeSelected(slot.hour, slot.minute) &&
                      "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                  )}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

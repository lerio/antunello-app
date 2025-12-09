"use client";

import { useState, useRef, useEffect, useCallback, ReactNode } from "react";
import { ChevronDown, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchableSelectProps<T> {
  /** Array of options to display */
  options: T[];
  /** Currently selected value (can be string or null) */
  value: string | null;
  /** Callback when selection changes */
  onChange: (value: string | null) => void;
  /** Get unique key for each option */
  getOptionKey: (option: T) => string;
  /** Render the selected value in the trigger button */
  renderSelected: (option: T | null) => ReactNode;
  /** Render an option in the dropdown list */
  renderOption: (option: T, isSelected: boolean) => ReactNode;
  /** Filter options based on search term (optional - enables search) */
  filterOption?: (option: T, searchTerm: string) => boolean;
  /** Placeholder text when nothing is selected */
  placeholder?: string;
  /** Search input placeholder */
  searchPlaceholder?: string;
  /** Whether the select is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
  /** Show error state */
  error?: boolean;
  /** Optional "none" option at the top */
  allowNone?: boolean;
  /** Label for the "none" option */
  noneLabel?: string;
}

export function SearchableSelect<T>({
  options,
  value,
  onChange,
  getOptionKey,
  renderSelected,
  renderOption,
  filterOption,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  disabled = false,
  className = "",
  error = false,
  allowNone = false,
  noneLabel = "None",
}: SearchableSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => getOptionKey(opt) === value) || null;

  // Click outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && filterOption && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, filterOption]);

  const handleSelect = useCallback(
    (optionKey: string | null) => {
      onChange(optionKey);
      setIsOpen(false);
      setSearchTerm("");
    },
    [onChange]
  );

  const toggleOpen = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
      if (isOpen) {
        setSearchTerm("");
      }
    }
  }, [disabled, isOpen]);

  // Filter options based on search
  const filteredOptions = filterOption && searchTerm
    ? options.filter((opt) => filterOption(opt, searchTerm))
    : options;

  return (
    <div ref={dropdownRef} className={cn("relative", className)}>
      {/* Trigger Button */}
      <button
        type="button"
        className={cn(
          "w-full px-4 py-3 text-left bg-white dark:bg-gray-800 border rounded-lg shadow-sm focus:outline-none text-base",
          error
            ? "border-red-500 dark:border-red-400"
            : "border-gray-300 dark:border-gray-600",
          disabled
            ? "opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-700"
            : "cursor-pointer"
        )}
        onClick={toggleOpen}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            {selectedOption ? (
              renderSelected(selectedOption)
            ) : value === null && allowNone ? (
              <span className="text-foreground">{noneLabel}</span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronDown
            size={20}
            className={cn(
              "ml-2 text-muted-foreground transition-transform flex-shrink-0",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden">
          {/* Search Input */}
          {filterOption && (
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-transparent border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-60 overflow-auto py-1">
            {/* None option */}
            {allowNone && (
              <button
                type="button"
                className={cn(
                  "w-full text-left px-4 py-3 flex items-center hover:bg-accent hover:text-accent-foreground transition-colors",
                  value === null
                    ? "bg-primary/10 text-primary"
                    : "text-foreground"
                )}
                onClick={() => handleSelect(null)}
              >
                <span className="flex-1 truncate">{noneLabel}</span>
                {value === null && (
                  <Check size={16} className="ml-2 text-primary flex-shrink-0" />
                )}
              </button>
            )}

            {/* Filtered options */}
            {filteredOptions.map((option) => {
              const key = getOptionKey(option);
              const isSelected = key === value;

              return (
                <button
                  key={key}
                  type="button"
                  className={cn(
                    "w-full text-left px-4 py-3 flex items-center hover:bg-accent hover:text-accent-foreground transition-colors",
                    isSelected ? "bg-primary/10 text-primary" : "text-foreground"
                  )}
                  onClick={() => handleSelect(key)}
                >
                  {renderOption(option, isSelected)}
                  {isSelected && (
                    <Check size={16} className="ml-2 text-primary flex-shrink-0" />
                  )}
                </button>
              );
            })}

            {/* No results */}
            {filteredOptions.length === 0 && (
              <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                No results found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

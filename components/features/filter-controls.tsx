"use client"

import * as React from "react"
import { ChevronDown, ChevronUp, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { MultiSelectChips, ChipOption } from "@/components/ui/multi-select-chips"
import { DualRangeSlider } from "@/components/ui/dual-range-slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CATEGORIES_WITH_TYPES, SUB_CATEGORIES } from "@/types/database"
import { CURRENCY_OPTIONS } from "@/constants/app-constants"
import { FilterCriteria } from "@/hooks/useFilteredTransactions"

type FilterControlsProps = {
  criteria: FilterCriteria
  onCriteriaChange: (criteria: FilterCriteria) => void
  availableCurrencies: string[]
  availableFundSources: Array<{ id: string; name: string }>
}

const TYPE_OPTIONS: ChipOption[] = [
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
  { value: "movement", label: "Movement" },
]

const MONTHS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
]

// Generate years from 2017 to current year (descending order)
const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: currentYear - 2016 }, (_, i) => ({
  value: String(currentYear - i),
  label: String(currentYear - i),
}))

/** A label with its controls: inline and right-aligned on mobile, stacked from `sm`. */
function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 sm:block">
      <span className="text-sm font-medium text-gray-600 dark:text-gray-400 sm:mb-2 sm:block">
        {label}
      </span>
      <div className="flex min-h-[32px] items-center justify-end sm:justify-start">
        {children}
      </div>
    </div>
  )
}

/** A removable chip for an active selection shown beside a collapsed section. */
function SelectedChip({
  label,
  onRemove,
  className = "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900",
}: {
  label: string
  onRemove: () => void
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        className,
      )}
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="hover:bg-white/20 dark:hover:bg-black/20 rounded-full p-0.5"
      >
        <X size={12} />
      </button>
    </span>
  )
}

export function FilterControls({
  criteria,
  onCriteriaChange,
  availableCurrencies,
  availableFundSources,
}: FilterControlsProps) {
  const [showCategories, setShowCategories] = React.useState(false)
  const [showFunds, setShowFunds] = React.useState(false)

  // Filter categories based on selected types
  const filteredCategories = React.useMemo(() => {
    // If no types selected or "movement" is selected, show all categories
    const hasIncomeOrExpense = criteria.types.includes('income') || criteria.types.includes('expense')
    if (!hasIncomeOrExpense || criteria.types.length === 0) {
      return CATEGORIES_WITH_TYPES
    }
    // Filter by selected types (income/expense)
    return CATEGORIES_WITH_TYPES.filter(cat =>
      criteria.types.includes(cat.type)
    )
  }, [criteria.types])

  // Category options based on filtered categories
  const categoryOptions: ChipOption[] = React.useMemo(() =>
    filteredCategories.map(cat => ({
      value: cat.category,
      label: cat.category,
    })),
    [filteredCategories]
  )

  // Get available subcategories based on selected main categories and types
  const availableSubcategories = React.useMemo(() => {
    const validCategories = filteredCategories.map(c => c.category)

    if (criteria.mainCategories.length === 0) {
      // If no main category selected, show subcategories from filtered categories
      return filteredCategories.flatMap(cat =>
        cat.subcategories.map(sub => ({ value: `${cat.category}::${sub}`, label: sub }))
      )
    }
    // Show subcategories for selected main categories (that are still valid)
    return criteria.mainCategories
      .filter(main => validCategories.includes(main))
      .flatMap(main =>
        (SUB_CATEGORIES[main] || []).map(sub => ({ value: `${main}::${sub}`, label: sub }))
      )
  }, [criteria.mainCategories, filteredCategories])

  // Currency options from available currencies
  const currencyOptions: ChipOption[] = availableCurrencies.map(c => ({
    value: c,
    label: c,
  }))

  // The amount range is only meaningful when one currency is selected.
  const selectedCurrency =
    criteria.currencies.length === 1 ? criteria.currencies[0] : null
  const currencySymbol = selectedCurrency
    ? CURRENCY_OPTIONS.find(option => option.value === selectedCurrency)?.symbol ??
      `${selectedCurrency} `
    : ""

  // Fund source options
  const fundSourceOptions: ChipOption[] = availableFundSources.map(fund => ({
    value: fund.id,
    label: fund.name,
  }))

  // Handle type change
  const handleTypeChange = (types: string[]) => {
    const newTypes = types as Array<"income" | "expense" | "movement">

    // Filter out categories that no longer match the new types
    const hasIncomeOrExpense = newTypes.includes('income') || newTypes.includes('expense')
    let validCategories = criteria.mainCategories
    let validSubCategories = criteria.subCategories

    if (hasIncomeOrExpense && newTypes.length > 0) {
      const allowedCategories = CATEGORIES_WITH_TYPES
        .filter(cat => newTypes.includes(cat.type))
        .map(cat => cat.category)

      validCategories = criteria.mainCategories.filter(cat => allowedCategories.includes(cat))
      validSubCategories = criteria.subCategories.filter(sub => {
        const [main] = sub.split("::")
        return allowedCategories.includes(main)
      })
    }

    onCriteriaChange({
      ...criteria,
      types: newTypes,
      mainCategories: validCategories,
      subCategories: validSubCategories,
    })
  }

  // Handle main category change
  const handleMainCategoryChange = (mainCategories: string[]) => {
    // Subcategories only make sense alongside their main category.
    const validSubCategories =
      mainCategories.length === 0
        ? []
        : criteria.subCategories.filter(sub => {
            const [main] = sub.split("::")
            return mainCategories.includes(main)
          })
    onCriteriaChange({
      ...criteria,
      mainCategories,
      subCategories: validSubCategories,
    })
  }

  // Handle subcategory change
  const handleSubCategoryChange = (subCategories: string[]) => {
    onCriteriaChange({ ...criteria, subCategories })
  }

  // Handle amount range change
  const handleAmountRangeChange = (value: [number | null, number | null]) => {
    onCriteriaChange({ ...criteria, amountMin: value[0], amountMax: value[1] })
  }

  // Handle currency change
  const handleCurrencyChange = (currencies: string[]) => {
    // The amount range only exists for a single currency; clearing it avoids
    // leaving an invisible range behind when the selection changes.
    onCriteriaChange({ ...criteria, currencies, amountMin: null, amountMax: null })
  }

  // Handle fund source change
  const handleFundSourceChange = (fundSourceIds: string[]) => {
    onCriteriaChange({ ...criteria, fundSourceIds })
  }

  // Handle month change
  const handleMonthChange = (value: string) => {
    if (value === "all") {
      onCriteriaChange({ ...criteria, month: null })
    } else {
      onCriteriaChange({ ...criteria, month: parseInt(value, 10) })
    }
  }

  // Handle year change
  const handleYearChange = (value: string) => {
    if (value === "all") {
      onCriteriaChange({ ...criteria, year: null, month: null })
    } else {
      onCriteriaChange({ ...criteria, year: parseInt(value, 10) })
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 space-y-4">
      {/* First Row: Period, Type, Currency - responsive grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
        {/* Period Filter */}
        <FilterRow label="Period">
          <div className="flex flex-wrap items-center justify-end gap-1.5 sm:justify-start">
            <Select
              name="filter-year"
              value={criteria.year?.toString() ?? "all"}
              onValueChange={handleYearChange}
            >
              <SelectTrigger className="w-[100px]" size="sm">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                {YEARS.map(year => (
                  <SelectItem key={year.value} value={year.value}>
                    {year.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              name="filter-month"
              value={criteria.month?.toString() ?? "all"}
              onValueChange={handleMonthChange}
              disabled={criteria.year === null}
            >
              <SelectTrigger className={cn("w-[88px]", criteria.year === null && "opacity-50")} size="sm">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {MONTHS.map(month => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label.slice(0, 3)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FilterRow>

        {/* Currency Filter */}
        {currencyOptions.length > 0 && (
          <FilterRow label="Currency">
            <MultiSelectChips
              options={currencyOptions}
              selected={criteria.currencies}
              onChange={handleCurrencyChange}
              size="md"
              className="justify-end sm:justify-start"
            />
          </FilterRow>
        )}

        {/* Type Filter */}
        <FilterRow label="Type">
          <MultiSelectChips
            options={TYPE_OPTIONS}
            selected={criteria.types}
            onChange={handleTypeChange}
            size="md"
            className="justify-end sm:justify-start"
          />
        </FilterRow>
      </div>

      {/* Category Filter - Collapsible */}
      <div>
        <div className="flex items-center justify-between w-full text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowCategories(!showCategories)}
              className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-200"
            >
              <span>Category</span>
              {showCategories ? (
                <ChevronUp size={16} />
              ) : (
                <ChevronDown size={16} />
              )}
            </button>
            {/* Selected categories and subcategories chips */}
            {criteria.mainCategories.map(cat => (
              <SelectedChip
                key={cat}
                label={cat}
                onRemove={() =>
                  handleMainCategoryChange(criteria.mainCategories.filter(c => c !== cat))
                }
              />
            ))}
            {criteria.subCategories.map(sub => (
              <SelectedChip
                key={sub}
                label={sub.split("::")[1] || sub}
                className="bg-gray-700 dark:bg-gray-300 text-white dark:text-gray-900"
                onRemove={() =>
                  handleSubCategoryChange(criteria.subCategories.filter(s => s !== sub))
                }
              />
            ))}
          </div>
        </div>
        {showCategories && (
          <div className="space-y-3">
            <MultiSelectChips
              options={categoryOptions}
              selected={criteria.mainCategories}
              onChange={handleMainCategoryChange}
              size="md"
            />
            {criteria.mainCategories.length > 0 && availableSubcategories.length > 0 && (
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-500 block mb-1.5">
                  Subcategory
                </span>
                <MultiSelectChips
                  options={availableSubcategories}
                  selected={criteria.subCategories}
                  onChange={handleSubCategoryChange}
                  size="md"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fund Source - Collapsible */}
      {fundSourceOptions.length > 0 && (
        <div>
          <div className="flex items-center justify-between w-full text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowFunds(!showFunds)}
                aria-expanded={showFunds}
                className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-200"
              >
                <span>Fund</span>
                {showFunds ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {criteria.fundSourceIds.map(id => (
                <SelectedChip
                  key={id}
                  label={fundSourceOptions.find(option => option.value === id)?.label ?? id}
                  onRemove={() =>
                    handleFundSourceChange(criteria.fundSourceIds.filter(fundId => fundId !== id))
                  }
                />
              ))}
            </div>
          </div>
          {showFunds && (
            <div className="min-h-[32px] flex items-center">
              <MultiSelectChips
                options={fundSourceOptions}
                selected={criteria.fundSourceIds}
                onChange={handleFundSourceChange}
                size="md"
              />
            </div>
          )}
        </div>
      )}

      {/* Amount Range */}
      {selectedCurrency && (
        <div>
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400 block mb-2">
            Amount Range
          </span>
          <DualRangeSlider
            name="filter-amount"
            min={0}
            max={10000}
            step={100}
            value={[criteria.amountMin, criteria.amountMax]}
            onValueChange={handleAmountRangeChange}
            formatValue={(v) => `${currencySymbol}${v.toLocaleString()}`}
          />
        </div>
      )}
    </div>
  )
}

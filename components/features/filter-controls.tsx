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
import { FilterCriteria } from "@/hooks/useFilteredTransactions"

type FilterControlsProps = {
  criteria: FilterCriteria
  onCriteriaChange: (criteria: FilterCriteria) => void
  availableCurrencies: string[]
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

// Generate years from 2017 to current year
const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: currentYear - 2016 }, (_, i) => ({
  value: String(2017 + i),
  label: String(2017 + i),
}))

export function FilterControls({
  criteria,
  onCriteriaChange,
  availableCurrencies,
}: FilterControlsProps) {
  const [showCategories, setShowCategories] = React.useState(false)

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
    // When main categories change, filter out subcategories that no longer apply
    const validSubCategories = criteria.subCategories.filter(sub => {
      const [main] = sub.split("::")
      return mainCategories.length === 0 || mainCategories.includes(main)
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
    onCriteriaChange({ ...criteria, currencies })
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
        <div>
          <label className="text-sm font-medium text-gray-600 dark:text-gray-400 block mb-2">
            Period
          </label>
          <div className="flex items-center gap-1.5 flex-wrap min-h-[32px]">
            <Select
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
        </div>

        {/* Currency Filter */}
        {currencyOptions.length > 0 && (
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400 block mb-2">
              Currency
            </label>
            <div className="min-h-[32px] flex items-center">
              <MultiSelectChips
                options={currencyOptions}
                selected={criteria.currencies}
                onChange={handleCurrencyChange}
                size="md"
              />
            </div>
          </div>
        )}

        {/* Type Filter */}
        <div>
          <label className="text-sm font-medium text-gray-600 dark:text-gray-400 block mb-2">
            Type
          </label>
          <div className="min-h-[32px] flex items-center">
            <MultiSelectChips
              options={TYPE_OPTIONS}
              selected={criteria.types}
              onChange={handleTypeChange}
              size="md"
            />
          </div>
        </div>
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
              <span
                key={cat}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
              >
                {cat}
                <button
                  type="button"
                  onClick={() => handleMainCategoryChange(criteria.mainCategories.filter(c => c !== cat))}
                  className="hover:bg-white/20 dark:hover:bg-black/20 rounded-full p-0.5"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            {criteria.subCategories.map(sub => {
              const label = sub.split("::")[1] || sub
              return (
                <span
                  key={sub}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 dark:bg-gray-300 text-white dark:text-gray-900"
                >
                  {label}
                  <button
                    type="button"
                    onClick={() => handleSubCategoryChange(criteria.subCategories.filter(s => s !== sub))}
                    className="hover:bg-white/20 dark:hover:bg-black/20 rounded-full p-0.5"
                  >
                    <X size={12} />
                  </button>
                </span>
              )
            })}
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
            {availableSubcategories.length > 0 && (
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-500 block mb-1.5">
                  Subcategory
                </label>
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

      {/* Amount Range */}
      <div>
        <label className="text-sm font-medium text-gray-600 dark:text-gray-400 block mb-2">
          Amount Range
        </label>
        <DualRangeSlider
          min={0}
          max={10000}
          step={100}
          value={[criteria.amountMin, criteria.amountMax]}
          onValueChange={handleAmountRangeChange}
          formatValue={(v) => `€${v.toLocaleString()}`}
        />
      </div>
    </div>
  )
}

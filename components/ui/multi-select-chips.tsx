"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export type ChipOption = {
  value: string
  label: string
}

type MultiSelectChipsProps = {
  options: ChipOption[]
  selected: string[]
  onChange: (selected: string[]) => void
  disabled?: boolean
  className?: string
  size?: "sm" | "md" | "default"
}

const sizeStyles = {
  sm: { chip: "px-2 py-0.5 text-xs", gap: "gap-1" },
  md: { chip: "px-2.5 py-1 text-xs", gap: "gap-1.5" },
  default: { chip: "px-3 py-1.5 text-sm", gap: "gap-2" },
}

export function MultiSelectChips({
  options,
  selected,
  onChange,
  disabled = false,
  className,
  size = "default",
}: MultiSelectChipsProps) {
  const toggleOption = (value: string) => {
    if (disabled) return
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  const styles = sizeStyles[size]

  return (
    <div className={cn("flex flex-wrap", styles.gap, className)}>
      {options.map(option => {
        const isSelected = selected.includes(option.value)
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => toggleOption(option.value)}
            className={cn(
              "rounded-full font-medium transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500",
              styles.chip,
              isSelected
                ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

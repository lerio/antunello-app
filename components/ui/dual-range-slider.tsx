"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { cn } from "@/lib/utils"

type DualRangeSliderProps = {
  min: number
  max: number
  step?: number
  value: [number | null, number | null]
  onValueChange: (value: [number | null, number | null]) => void
  formatValue?: (value: number) => string
  className?: string
  disabled?: boolean
}

export function DualRangeSlider({
  min,
  max,
  step = 1,
  value,
  onValueChange,
  formatValue = (v) => v.toLocaleString(),
  className,
  disabled = false,
}: DualRangeSliderProps) {
  // Convert null values to min/max for the slider
  const sliderValue: [number, number] = [
    value[0] ?? min,
    value[1] ?? max,
  ]

  const handleValueChange = (newValue: number[]) => {
    const [newMin, newMax] = newValue as [number, number]
    onValueChange([
      newMin === min ? null : newMin,
      newMax === max ? null : newMax,
    ])
  }

  return (
    <div className={cn("space-y-4", className)}>
      <SliderPrimitive.Root
        className={cn(
          "relative flex w-full touch-none select-none items-center",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        min={min}
        max={max}
        step={step}
        value={sliderValue}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <SliderPrimitive.Range className="absolute h-full bg-gray-900 dark:bg-gray-100" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className="block h-5 w-5 rounded-full border-2 border-gray-900 dark:border-gray-100 bg-white dark:bg-gray-800 ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          aria-label="Minimum amount"
        />
        <SliderPrimitive.Thumb
          className="block h-5 w-5 rounded-full border-2 border-gray-900 dark:border-gray-100 bg-white dark:bg-gray-800 ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          aria-label="Maximum amount"
        />
      </SliderPrimitive.Root>

      {/* Value labels */}
      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>
          {value[0] !== null ? formatValue(value[0]) : "Any"}
        </span>
        <span>
          {value[1] !== null ? formatValue(value[1]) : "Any"}
        </span>
      </div>
    </div>
  )
}

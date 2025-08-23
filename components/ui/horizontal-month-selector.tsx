import React, { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MonthOption } from '@/hooks/useAvailableMonths'

interface HorizontalMonthSelectorProps {
  months: MonthOption[]
  selectedMonth: { year: number; month: number }
  onMonthSelect: (year: number, month: number) => void
  className?: string
}

export function HorizontalMonthSelector({
  months,
  selectedMonth,
  onMonthSelect,
  className = ""
}: HorizontalMonthSelectorProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)
  const [showLeftFade, setShowLeftFade] = useState(false)
  const [showRightFade, setShowRightFade] = useState(false)
  
  // Determine if we should show navigation arrows based on selected month
  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1
  const isCurrentMonthSelected = selectedMonth.year === currentYear && selectedMonth.month === currentMonth
  const selectedDate = new Date(selectedMonth.year, selectedMonth.month - 1, 1)
  const currentDate = new Date(currentYear, currentMonth - 1, 1)
  const isInFuture = selectedDate > currentDate
  const isInPast = selectedDate < currentDate

  // Center the selected month with smooth animation after DOM updates
  useEffect(() => {
    if (selectedRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current
      const selectedElement = selectedRef.current
      
      // Use setTimeout to delay centering until after React has completed DOM updates
      const timeoutId = setTimeout(() => {
        const containerWidth = container.clientWidth
        const elementLeft = selectedElement.offsetLeft
        const elementWidth = selectedElement.clientWidth
        
        // Calculate scroll position to center the element
        const scrollLeft = elementLeft - (containerWidth / 2) + (elementWidth / 2)
        
        // Use smooth scrolling animation
        container.scrollTo({
          left: scrollLeft,
          behavior: 'smooth'
        })
      }, 50) // Small delay to allow DOM updates to complete
      
      return () => clearTimeout(timeoutId)
    }
  }, [selectedMonth])

  // Update fade indicators based on scroll position
  const updateFadeIndicators = () => {
    if (!scrollContainerRef.current) return
    
    const container = scrollContainerRef.current
    const scrollLeft = container.scrollLeft
    const maxScrollLeft = container.scrollWidth - container.clientWidth
    
    setShowLeftFade(scrollLeft > 10)
    setShowRightFade(scrollLeft < maxScrollLeft - 10)
  }

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    // Initial check
    updateFadeIndicators()

    container.addEventListener('scroll', updateFadeIndicators)
    window.addEventListener('resize', updateFadeIndicators)

    return () => {
      container.removeEventListener('scroll', updateFadeIndicators)
      window.removeEventListener('resize', updateFadeIndicators)
    }
  }, [months])

  const navigateToCurrentMonth = () => {
    const today = new Date()
    onMonthSelect(today.getFullYear(), today.getMonth() + 1)
  }

  return (
    <div className={`relative ${className}`}>
      {/* Left arrow - Return to current month (when browsing future) */}
      {!isCurrentMonthSelected && isInFuture && (
        <div className="absolute left-0 top-0 bottom-0 z-20 flex items-center">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-50 dark:from-gray-900 via-gray-50/80 dark:via-gray-900/80 to-transparent w-12 pointer-events-none" />
          <button
            onClick={navigateToCurrentMonth}
            className="p-1.5 rounded-full bg-white dark:bg-gray-800 shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-gray-300 dark:border-gray-600 relative z-10"
            aria-label="Return to current month"
            title="Return to current month"
          >
            <ChevronLeft size={16} className="text-gray-700 dark:text-gray-300" />
          </button>
        </div>
      )}

      {/* Right arrow - Return to current month (when browsing past) */}
      {!isCurrentMonthSelected && isInPast && (
        <div className="absolute right-0 top-0 bottom-0 z-20 flex items-center justify-end">
          <div className="absolute inset-0 bg-gradient-to-l from-gray-50 dark:from-gray-900 via-gray-50/80 dark:via-gray-900/80 to-transparent w-12 pointer-events-none" />
          <button
            onClick={navigateToCurrentMonth}
            className="p-1.5 rounded-full bg-white dark:bg-gray-800 shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-gray-300 dark:border-gray-600 relative z-10"
            aria-label="Return to current month"
            title="Return to current month"
          >
            <ChevronRight size={16} className="text-gray-700 dark:text-gray-300" />
          </button>
        </div>
      )}

      {/* Scrollable months container */}
      <div
        ref={scrollContainerRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide py-2 px-8"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {months.map((month) => {
          const isSelected = month.year === selectedMonth.year && month.month === selectedMonth.month
          
          return (
            <button
              key={`${month.year}-${month.month}`}
              ref={isSelected ? selectedRef : undefined}
              onClick={() => onMonthSelect(month.year, month.month)}
              className={`
                flex-shrink-0 px-4 py-1.5 rounded-lg font-medium text-sm transition-all transform
                ${isSelected
                  ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 shadow-lg scale-105'
                  : month.isToday
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                    : month.isFuture
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-md'
                }
                ${isSelected ? 'hover:scale-105' : 'hover:scale-102'}
              `}
            >
              <div className="text-center min-w-[80px]">
                <div className="font-semibold">
                  {month.date.toLocaleDateString('en-US', { month: 'long' })}
                </div>
                {month.year !== new Date().getFullYear() && (
                  <div className={`text-xs ${isSelected ? 'text-white dark:text-gray-900' : 'text-gray-500 dark:text-gray-400'}`}>
                    {month.year}
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Custom scrollbar hide styles */}
      <style jsx>{`
        .scrollbar-hide {
          -webkit-overflow-scrolling: touch;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  )
}
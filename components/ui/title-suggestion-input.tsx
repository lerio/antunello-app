'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, Check, MinusCircle, PlusCircle, Loader2 } from 'lucide-react'
import { TitleSuggestion } from '@/types/database'
import { useTitleSuggestions } from '@/hooks/useTitleSuggestions'

interface TitleSuggestionInputProps {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly onSuggestionSelect: (suggestion: TitleSuggestion) => void
  readonly placeholder?: string
  readonly disabled?: boolean
  readonly className?: string
  readonly minLength?: number
  readonly id?: string
  readonly name?: string
}

export function TitleSuggestionInput({
  value,
  onChange,
  onSuggestionSelect,
  placeholder = "Enter transaction title...",
  disabled = false,
  className = "",
  minLength = 2,
  id,
  name
}: TitleSuggestionInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { suggestions, isLoading, error, hasSuggestions, shouldShowSuggestions } = useTitleSuggestions(value, minLength)

  // Auto-open dropdown when suggestions are available
  useEffect(() => {
    if (hasSuggestions && shouldShowSuggestions && isFocused) {
      setIsOpen(true)
      setSelectedIndex(-1)
    } else if (!hasSuggestions || !shouldShowSuggestions) {
      setIsOpen(false)
      setSelectedIndex(-1)
    }
  }, [hasSuggestions, shouldShowSuggestions, isFocused])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
        setSelectedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || !hasSuggestions) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSuggestionSelect(suggestions[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setSelectedIndex(-1)
        break
    }
  }, [isOpen, hasSuggestions, suggestions, selectedIndex])

  const handleSuggestionSelect = (suggestion: TitleSuggestion) => {
    onChange(suggestion.title)
    onSuggestionSelect(suggestion)
    setIsOpen(false)
    setSelectedIndex(-1)
    inputRef.current?.blur()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
    setSelectedIndex(-1)
  }

  const handleInputFocus = () => {
    setIsFocused(true)
    if (shouldShowSuggestions && hasSuggestions) {
      setIsOpen(true)
    }
  }

  const handleInputBlur = () => {
    setIsFocused(false)
    // Use setTimeout to allow click events to register before closing
    setTimeout(() => setIsOpen(false), 150)
  }

  const getTypeIcon = (type: 'expense' | 'income') => {
    return type === 'expense' ? (
      <MinusCircle size={16} className="text-red-500" />
    ) : (
      <PlusCircle size={16} className="text-green-500" />
    )
  }

  const getFrequencyBadge = (frequency: number) => {
    if (frequency === 1) return null
    return (
      <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
        Used {frequency} times
      </span>
    )
  }

  return (
    <div className="relative w-full">
      {/* Input Field */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          id={id}
          name={name}
          className={`
            w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg
            bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed
            ${className}
          `}
        />

        {/* Loading Indicator */}
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <Loader2 size={16} className="text-gray-400 animate-spin" />
          </div>
        )}
      </div>

      {/* Suggestion Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="
            absolute top-full left-0 right-0 mt-1
            bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg
            max-h-60 overflow-y-auto z-50
          "
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => handleSuggestionSelect(suggestion)}
              className={`
                w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
                border-b border-gray-100 dark:border-gray-600 last:border-b-0
                ${selectedIndex === index ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-600' : ''}
              `}
            >
              {/* Main Title Row */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {getTypeIcon(suggestion.type)}
                  <div className="relative min-w-0 flex-1">
                    <span className="font-medium text-gray-900 dark:text-gray-100 block overflow-hidden whitespace-nowrap">
                      {suggestion.title}
                    </span>
                    {/* Fade effect for long titles */}
                    <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent dark:from-gray-800 pointer-events-none" />
                  </div>
                </div>
                {getFrequencyBadge(suggestion.frequency)}
              </div>

              {/* Category Row */}
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 min-w-0">
                <span className="font-medium overflow-hidden whitespace-nowrap">{suggestion.main_category}</span>
                {suggestion.sub_category && (
                  <>
                    <ChevronDown size={12} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                    <span className="overflow-hidden whitespace-nowrap">{suggestion.sub_category}</span>
                  </>
                )}
              </div>

              {/* Auto-fill Indicator */}
              <div className="mt-1 text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <Check size={12} />
                Will auto-fill: {suggestion.type}, {suggestion.main_category}
                {suggestion.sub_category && `, ${suggestion.sub_category}`}
              </div>
            </button>
          ))}

          {/* No Results */}
          {!isLoading && suggestions.length === 0 && shouldShowSuggestions && (
            <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
              No matching titles found
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="px-4 py-3 text-sm text-red-600 dark:text-red-400 text-center">
              Failed to load suggestions
            </div>
          )}
        </div>
      )}
    </div>
  )
}
import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, BadgeEuro, BadgeJapaneseYen, BadgeDollarSign, BadgePoundSterling, BadgeCent } from 'lucide-react'

interface FundOption {
  id: string
  name: string
  currency: string
}

interface FundSelectProps {
  readonly options: FundOption[]
  readonly value: string | null
  readonly onChange: (value: string | null) => void
  readonly placeholder: string
  readonly disabled?: boolean
  readonly className?: string
  readonly error?: boolean
}

const getCurrencyIcon = (currency: string) => {
  switch (currency) {
    case "EUR":
      return BadgeEuro;
    case "JPY":
      return BadgeJapaneseYen;
    case "USD":
    case "CAD":
    case "AUD":
      return BadgeDollarSign;
    case "GBP":
      return BadgePoundSterling;
    default:
      return BadgeCent;
  }
};

export function FundSelect({
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
  className = "",
  error = false
}: FundSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [hasSelected, setHasSelected] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const selectedOption = options.find(option => option.id === value)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Track if a selection has been made from a value change
  useEffect(() => {
    if (value !== null || hasSelected) {
      setHasSelected(true)
    }
  }, [value, hasSelected])

  const handleSelect = (optionId: string | null) => {
    setHasSelected(true)
    onChange(optionId)
    setIsOpen(false)
  }

  const toggleOpen = () => {
    if (!disabled) {
      setIsOpen(!isOpen)
    }
  }

  const renderSelectedValue = () => {
    // If "No fund" was explicitly selected (value is null but hasSelected is true)
    if (hasSelected && !selectedOption && value === null) {
      return (
        <div className="flex items-center">
          <span className="truncate">No fund</span>
        </div>
      )
    }

    if (!selectedOption) {
      return (
        <span className="text-gray-500 dark:text-gray-400">
          {placeholder}
        </span>
      )
    }

    const CurrencyIcon = getCurrencyIcon(selectedOption.currency);

    return (
      <div className="flex items-center gap-2">
        <CurrencyIcon size={16} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
        <span className="truncate">{selectedOption.name}</span>
      </div>
    )
  }

  const renderOption = (option: FundOption) => {
    const isSelected = option.id === value
    const CurrencyIcon = getCurrencyIcon(option.currency);

    return (
      <button
        key={option.id}
        type="button"
        className={`w-full text-left px-4 py-3 flex items-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
          isSelected ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'
        }`}
        onClick={() => handleSelect(option.id)}
      >
        <CurrencyIcon size={16} className={`flex-shrink-0 mr-2 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`} />
        <span className="flex-1 truncate">{option.name}</span>
        {isSelected && (
          <Check
            size={16}
            className="ml-2 text-blue-600 dark:text-blue-400 flex-shrink-0"
          />
        )}
      </button>
    )
  }

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        className={`w-full px-4 py-3 text-left bg-white dark:bg-gray-800 border rounded-lg shadow-sm focus:outline-none text-base ${
          error
            ? 'border-red-500 dark:border-red-400'
            : 'border-gray-300 dark:border-gray-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-700' : 'cursor-pointer'}`}
        onClick={toggleOpen}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            {renderSelectedValue()}
          </div>
          <ChevronDown
            size={20}
            className={`ml-2 text-gray-500 dark:text-gray-400 transition-transform flex-shrink-0 ${
              isOpen ? 'transform rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
          <div className="py-1">
            {/* "No selection" option for regular source dropdown */}
            {placeholder === "Select fund" && (
              <button
                type="button"
                className={`w-full text-left px-4 py-3 flex items-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                  hasSelected && value === null ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'
                }`}
                onClick={() => handleSelect(null)}
              >
                <span className="flex-1 truncate">No fund</span>
                {hasSelected && value === null && (
                  <Check
                    size={16}
                    className="ml-2 text-blue-600 dark:text-blue-400 flex-shrink-0"
                  />
                )}
              </button>
            )}
            {options.map(renderOption)}
          </div>
        </div>
      )}
    </div>
  )
}

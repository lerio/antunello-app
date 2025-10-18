import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { getCategoryIcon } from '@/types/category-icons'

interface Option {
  value: string
  label: string
  isMainCategory?: boolean
}

interface CategorySelectProps {
  readonly options: Option[]
  readonly value: string
  readonly onChange: (value: string) => void
  readonly placeholder: string
  readonly disabled?: boolean
  readonly className?: string
}

export function CategorySelect({
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
  className = ""
}: CategorySelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const selectedOption = options.find(option => option.value === value)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (optionValue: string) => {
    onChange(optionValue)
    setIsOpen(false)
  }

  const toggleOpen = () => {
    if (!disabled) {
      setIsOpen(!isOpen)
    }
  }

  const renderSelectedValue = () => {
    if (!selectedOption) {
      return (
        <span className="text-gray-500 dark:text-gray-400">
          {placeholder}
        </span>
      )
    }

    const IconComponent = selectedOption.isMainCategory !== false ? getCategoryIcon(selectedOption.value) : null

    return (
      <div className="flex items-center">
        {IconComponent && (
          <IconComponent 
            size={18} 
            className="mr-3 text-gray-600 dark:text-gray-400 flex-shrink-0" 
          />
        )}
        <span className="truncate">{selectedOption.label}</span>
      </div>
    )
  }

  const renderOption = (option: Option) => {
    const IconComponent = option.isMainCategory !== false ? getCategoryIcon(option.value) : null
    const isSelected = option.value === value

    return (
      <button
        key={option.value}
        type="button"
        className={`w-full text-left px-4 py-3 flex items-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
          isSelected ? 'bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' : 'text-gray-900 dark:text-gray-100'
        } ${option.isMainCategory === false ? 'pl-12' : ''}`}
        onClick={() => handleSelect(option.value)}
      >
        {IconComponent && (
          <IconComponent 
            size={18} 
            className={`mr-3 flex-shrink-0 ${
              isSelected 
                ? 'text-indigo-600 dark:text-indigo-400' 
                : 'text-gray-600 dark:text-gray-400'
            }`} 
          />
        )}
        <span className="flex-1 truncate">{option.label}</span>
        {isSelected && (
          <Check 
            size={16} 
            className="ml-2 text-indigo-600 dark:text-indigo-400 flex-shrink-0" 
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
        className={`w-full px-4 py-3 text-left bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none text-base ${
          disabled ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-900' : 'cursor-pointer'
        }`}
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
            className={`ml-2 text-gray-400 dark:text-gray-500 transition-transform flex-shrink-0 ${
              isOpen ? 'transform rotate-180' : ''
            }`} 
          />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
          <div className="py-1">
            {options.map(renderOption)}
          </div>
        </div>
      )}
    </div>
  )
}
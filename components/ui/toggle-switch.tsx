import React from 'react'

interface ToggleSwitchProps {
  id: string
  name: string
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
  className?: string
}

export function ToggleSwitch({
  id,
  name,
  checked,
  onChange,
  label,
  disabled = false,
  className = ""
}: ToggleSwitchProps) {
  return (
    <div 
      className={`flex items-center justify-between gap-4 py-2 px-1 -mx-1 rounded-lg cursor-pointer ${className} ${disabled ? 'cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
      onClick={() => !disabled && onChange(!checked)}
    >
      <label 
        htmlFor={id} 
        className="text-base font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none flex-1 leading-6 pointer-events-none"
      >
        {label}
      </label>
      
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        id={id}
        name={name}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`
          relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent 
          transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 
          focus:ring-offset-2 dark:focus:ring-offset-gray-900 transform active:scale-95
          ${checked 
            ? 'bg-indigo-600 dark:bg-indigo-500 shadow-lg' 
            : 'bg-gray-200 dark:bg-gray-700'
          }
          ${disabled 
            ? 'opacity-50 cursor-not-allowed' 
            : 'hover:shadow-md active:shadow-sm'
          }
        `}
      >
        <span className="sr-only">{label}</span>
        <span
          aria-hidden="true"
          className={`
            pointer-events-none inline-block h-5 w-5 mt-0.5 transform rounded-full bg-white 
            shadow-lg ring-0 transition-all duration-300 ease-in-out
            ${checked ? 'translate-x-5 shadow-xl' : 'translate-x-0.5 shadow-md'}
          `}
        />
      </button>
    </div>
  )
}
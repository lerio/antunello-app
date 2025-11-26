import React from 'react'
import { LucideIcon } from 'lucide-react'

interface FloatingButtonProps {
  readonly onClick: () => void
  readonly icon: LucideIcon
  readonly label: string
  readonly position?: 'bottom' | 'stacked'
  readonly className?: string
}

export function FloatingButton({
  onClick,
  icon: Icon,
  label,
  position = 'bottom',
  className = ''
}: FloatingButtonProps) {
  const positionClass = position === 'stacked' ? 'bottom-52' : 'bottom-20'

  return (
    <button
      onClick={onClick}
      className={`fixed ${positionClass} right-8 w-16 h-16 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-full flex items-center justify-center shadow-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors z-60 ${className}`}
      aria-label={label}
    >
      <Icon size={28} />
    </button>
  )
}
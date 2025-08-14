import React from 'react'
import { EyeOff } from 'lucide-react'

interface DailyHiddenIndicatorProps {
  count: number
}

export function DailyHiddenIndicator({ count }: DailyHiddenIndicatorProps) {
  if (count === 0) return null

  return (
    <div className="inline-flex items-center ml-2 text-xs text-gray-400 dark:text-gray-500">
      <EyeOff size={10} className="mr-1" />
      <span>{count}</span>
    </div>
  )
}
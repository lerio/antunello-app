import React, { useState } from 'react'
import { EyeOff } from 'lucide-react'
import { formatCurrency } from '@/utils/currency'

interface HiddenTransactionsTooltipProps {
  readonly count: number
  readonly hiddenIncomeTotal: number
  readonly hiddenExpenseTotal: number
}

export function HiddenTransactionsTooltip({ 
  count, 
  hiddenIncomeTotal, 
  hiddenExpenseTotal 
}: HiddenTransactionsTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  
  if (count === 0) return null

  const hiddenNetTotal = hiddenIncomeTotal - hiddenExpenseTotal
  
  return (
    <div className="relative inline-block">
      <button
        className="ml-2 inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
      >
        <EyeOff size={12} className="mr-1" />
        {count}
      </button>
      
      {isVisible && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
          <div className="bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg border border-gray-700 min-w-max">
            <div className="font-medium text-gray-200 mb-2 text-center">
              Hidden Transactions
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center gap-3">
                <span className="text-gray-300">Count:</span>
                <span className="font-mono">{count}</span>
              </div>
              {hiddenIncomeTotal > 0 && (
                <div className="flex justify-between items-center gap-3">
                  <span className="text-green-400">Income:</span>
                  <span className="font-mono text-green-400">
                    +{formatCurrency(hiddenIncomeTotal, "EUR")}
                  </span>
                </div>
              )}
              {hiddenExpenseTotal > 0 && (
                <div className="flex justify-between items-center gap-3">
                  <span className="text-red-400">Expenses:</span>
                  <span className="font-mono text-red-400">
                    -{formatCurrency(hiddenExpenseTotal, "EUR")}
                  </span>
                </div>
              )}
              <div className="border-t border-gray-600 pt-1 mt-2">
                <div className="flex justify-between items-center gap-3 font-medium">
                  <span className="text-gray-300">Net Impact:</span>
                  <span className={`font-mono ${hiddenNetTotal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {hiddenNetTotal >= 0 ? '+' : ''}{formatCurrency(Math.abs(hiddenNetTotal), "EUR")}
                  </span>
                </div>
              </div>
            </div>
            {/* Tooltip arrow */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2">
              <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900 dark:border-t-gray-800"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
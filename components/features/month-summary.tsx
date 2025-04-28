import { Transaction } from '@/types/database'
import { formatCurrency } from '@/utils/currency'
import { CATEGORY_ICONS } from '@/utils/categories'
import { LucideProps } from 'lucide-react'

type CurrencyTotals = {
  [currency: string]: number
}

type CategoryTotals = {
  [category: string]: {
    [currency: string]: number
  }
}

type MonthSummaryProps = {
  transactions: Transaction[]
}

export default function MonthSummary({ transactions }: MonthSummaryProps) {
  const expenseTotals: CurrencyTotals = {}
  const incomeTotals: CurrencyTotals = {}
  const categoryTotals: CategoryTotals = {}

  // Calculate totals
  transactions.forEach(transaction => {
    const amount = transaction.amount
    const currency = transaction.currency

    // Update expense/income totals
    if (transaction.type === 'expense') {
      expenseTotals[currency] = (expenseTotals[currency] || 0) + amount
    } else {
      incomeTotals[currency] = (incomeTotals[currency] || 0) + amount
    }

    // Update category totals
    if (!categoryTotals[transaction.main_category]) {
      categoryTotals[transaction.main_category] = {}
    }
    categoryTotals[transaction.main_category][currency] = 
      (categoryTotals[transaction.main_category][currency] || 0) + 
      (transaction.type === 'expense' ? amount : -amount)
  })

  // Calculate balance
  const balanceTotals: CurrencyTotals = {}
  Object.keys(incomeTotals).forEach(currency => {
    balanceTotals[currency] = (incomeTotals[currency] || 0) - (expenseTotals[currency] || 0)
  })

  return (
    <div className="mb-8 space-y-6">
      {/* Overall Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded">
          <h3 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">Total Expenses</h3>
          {Object.entries(expenseTotals).map(([currency, amount]) => (
            <div key={currency} className="text-red-600 dark:text-red-400 text-lg font-semibold">
              {formatCurrency(amount, currency)}
            </div>
          ))}
        </div>
        
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded">
          <h3 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">Total Income</h3>
          {Object.entries(incomeTotals).map(([currency, amount]) => (
            <div key={currency} className="text-green-600 dark:text-green-400 text-lg font-semibold">
              {formatCurrency(amount, currency)}
            </div>
          ))}
        </div>
        
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded">
          <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Balance</h3>
          {Object.entries(balanceTotals).map(([currency, amount]) => (
            <div 
              key={currency} 
              className={`text-lg font-semibold ${
                amount >= 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {formatCurrency(Math.abs(amount), currency)}
              {amount >= 0 ? ' gain' : ' loss'}
            </div>
          ))}
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded">
        <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-4">Category Breakdown</h3>
        <div className="space-y-3">
          {Object.entries(categoryTotals)
            .filter(([_, amounts]) => Object.values(amounts).some(amount => amount !== 0))
            .map(([category, amounts]) => {
              const Icon = CATEGORY_ICONS[category]
              return (
                <div key={category} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon {...{ size: 16, className: "text-gray-500 dark:text-gray-400" } as LucideProps} />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{category}</span>
                  </div>
                  <div className="text-right">
                    {Object.entries(amounts).map(([currency, amount]) => (
                      <div 
                        key={currency}
                        className={`text-sm font-medium ${
                          amount > 0 
                            ? 'text-red-600 dark:text-red-400' 
                            : 'text-green-600 dark:text-green-400'
                        }`}
                      >
                        {formatCurrency(Math.abs(amount), currency)}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
} 
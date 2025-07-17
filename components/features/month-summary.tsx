import { Transaction } from '@/types/database'
import { formatCurrency } from '@/utils/currency'
import { CATEGORY_ICONS } from '@/utils/categories'
import { LucideProps } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
  isLoading?: boolean
}

export default function MonthSummary({ transactions, isLoading = false }: MonthSummaryProps) {
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

  const LoadingSkeleton = () => (
    <div className="space-y-6 w-full">
      {/* Loading skeleton for summary cards */}
      <div className="summary-cards-grid">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="h-32 flex flex-col">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded animate-pulse w-20"></div>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center px-4 pb-4 pt-0">
              <div className="space-y-2">
                <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded animate-pulse w-24"></div>
                <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded animate-pulse w-16"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Loading skeleton for category breakdown */}
      <Card className="category-breakdown">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="w-full">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between py-2 gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="h-4 w-4 bg-gray-300 dark:bg-gray-700 rounded animate-pulse"></div>
                  <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded animate-pulse w-20"></div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded animate-pulse w-14"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )

  if (isLoading) {
    return <LoadingSkeleton />
  }

  return (
    <div className="space-y-6 w-full">
      {/* Fixed-height summary cards with proper grid */}
      <div className="summary-cards-grid">
        <Card className="h-32 flex flex-col">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-sm font-medium text-red-800 dark:text-red-200">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center px-4 pb-4 pt-0">
            <div className="space-y-1 overflow-hidden">
              {Object.entries(expenseTotals).length > 0 ? (
                Object.entries(expenseTotals).map(([currency, amount]) => (
                  <div key={currency} className="text-red-600 dark:text-red-400 text-lg font-bold truncate">
                    {formatCurrency(amount, currency)}
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground text-lg">-</div>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card className="h-32 flex flex-col">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-sm font-medium text-green-800 dark:text-green-200">Total Income</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center px-4 pb-4 pt-0">
            <div className="space-y-1 overflow-hidden">
              {Object.entries(incomeTotals).length > 0 ? (
                Object.entries(incomeTotals).map(([currency, amount]) => (
                  <div key={currency} className="text-green-600 dark:text-green-400 text-lg font-bold truncate">
                    {formatCurrency(amount, currency)}
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground text-lg">-</div>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card className="h-32 flex flex-col">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-sm font-medium text-blue-800 dark:text-blue-200">Balance</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center px-4 pb-4 pt-0">
            <div className="space-y-1 overflow-hidden">
              {Object.entries(balanceTotals).length > 0 ? (
                Object.entries(balanceTotals).map(([currency, amount]) => (
                  <div key={currency} className="flex flex-col">
                    <div className={`text-lg font-bold truncate ${amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {formatCurrency(Math.abs(amount), currency)}
                      <span className="text-xs text-muted-foreground ml-1">
                        {amount >= 0 ? 'gain' : 'loss'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground text-lg">-</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category breakdown with consistent layout */}
      <Card className="category-breakdown">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="w-full">
          {Object.entries(categoryTotals).filter(([_, amounts]) => Object.values(amounts).some(amount => amount !== 0)).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(categoryTotals)
                .filter(([_, amounts]) => Object.values(amounts).some(amount => amount !== 0))
                .map(([category, amounts]) => {
                  const Icon = CATEGORY_ICONS[category]
                  return (
                    <div key={category} className="flex items-center justify-between py-2 gap-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Icon {...{ size: 16, className: "text-gray-500 dark:text-gray-400 flex-shrink-0" } as LucideProps} />
                        <span className="font-medium text-gray-700 dark:text-gray-300 text-sm truncate">{category}</span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {Object.entries(amounts).map(([currency, amount]) => (
                          <div 
                            key={currency}
                            className={`font-semibold text-sm ${amount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                            {formatCurrency(Math.abs(amount), currency)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No transactions this month
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 
import { Transaction, getCategoryType } from '@/types/database'
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
  // Use EUR as the unified currency for all calculations
  let expenseTotal = 0
  let incomeTotal = 0
  const incomeCategoryTotals: Record<string, number> = {}
  const expenseCategoryTotals: Record<string, number> = {}

  // Calculate totals using EUR amounts
  transactions.forEach(transaction => {
    // Use EUR amount if available, otherwise fall back to original amount (assuming EUR)
    const eurAmount = transaction.eur_amount || (transaction.currency === 'EUR' ? transaction.amount : 0)
    
    // Skip transactions without EUR conversion (to avoid incorrect totals)
    if (eurAmount === 0 && transaction.currency !== 'EUR') {
      return
    }

    // Update expense/income totals
    if (transaction.type === 'expense') {
      expenseTotal += eurAmount
      // Update expense category totals
      if (!expenseCategoryTotals[transaction.main_category]) {
        expenseCategoryTotals[transaction.main_category] = 0
      }
      expenseCategoryTotals[transaction.main_category] += eurAmount
    } else {
      incomeTotal += eurAmount
      // Update income category totals
      if (!incomeCategoryTotals[transaction.main_category]) {
        incomeCategoryTotals[transaction.main_category] = 0
      }
      incomeCategoryTotals[transaction.main_category] += eurAmount
    }
  })

  // Calculate balance
  const balanceTotal = incomeTotal - expenseTotal

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
              {expenseTotal > 0 ? (
                <div className="text-red-600 dark:text-red-400 text-lg font-bold truncate">
                  {formatCurrency(expenseTotal, 'EUR')}
                </div>
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
              {incomeTotal > 0 ? (
                <div className="text-green-600 dark:text-green-400 text-lg font-bold truncate">
                  {formatCurrency(incomeTotal, 'EUR')}
                </div>
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
              {(incomeTotal > 0 || expenseTotal > 0) ? (
                <div className="flex flex-col">
                  <div className={`text-lg font-bold truncate ${balanceTotal >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(Math.abs(balanceTotal), 'EUR')}
                    <span className="text-xs text-muted-foreground ml-1">
                      {balanceTotal >= 0 ? 'gain' : 'loss'}
                    </span>
                  </div>
                </div>
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
          {(Object.keys(incomeCategoryTotals).length > 0 || Object.keys(expenseCategoryTotals).length > 0) ? (
            <div className="space-y-6">
              {/* Income Categories */}
              {Object.keys(incomeCategoryTotals).length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-green-700 dark:text-green-300 mb-3">Income</h4>
                  <div className="space-y-3">
                    {Object.entries(incomeCategoryTotals)
                      .sort(([, a], [, b]) => b - a) // Sort by amount (highest to lowest)
                      .map(([category, amount]) => {
                        const Icon = CATEGORY_ICONS[category]
                        return (
                          <div key={category} className="flex items-center justify-between py-2 gap-3">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Icon {...{ size: 16, className: "text-gray-500 dark:text-gray-400 flex-shrink-0" } as LucideProps} />
                              <span className="font-medium text-gray-700 dark:text-gray-300 text-sm truncate">{category}</span>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="font-semibold text-sm text-green-600 dark:text-green-400">
                                {formatCurrency(amount, 'EUR')}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}

              {/* Expense Categories */}
              {Object.keys(expenseCategoryTotals).length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-red-700 dark:text-red-300 mb-3">Expenses</h4>
                  <div className="space-y-3">
                    {Object.entries(expenseCategoryTotals)
                      .sort(([, a], [, b]) => b - a) // Sort by amount (highest to lowest)
                      .map(([category, amount]) => {
                        const Icon = CATEGORY_ICONS[category]
                        return (
                          <div key={category} className="flex items-center justify-between py-2 gap-3">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Icon {...{ size: 16, className: "text-gray-500 dark:text-gray-400 flex-shrink-0" } as LucideProps} />
                              <span className="font-medium text-gray-700 dark:text-gray-300 text-sm truncate">{category}</span>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="font-semibold text-sm text-red-600 dark:text-red-400">
                                {formatCurrency(amount, 'EUR')}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}
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
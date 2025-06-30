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
    <div className="mb-8">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <Card className="col-span-2 md:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-red-800 dark:text-red-200">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.entries(expenseTotals).map(([currency, amount]) => (
              <div key={currency} className="text-red-600 dark:text-red-400 text-2xl font-bold">
                {formatCurrency(amount, currency)}
              </div>
            ))}
          </CardContent>
        </Card>
        
        <Card className="col-span-2 md:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-green-800 dark:text-green-200">Total Income</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.entries(incomeTotals).map(([currency, amount]) => (
              <div key={currency} className="text-green-600 dark:text-green-400 text-2xl font-bold">
                {formatCurrency(amount, currency)}
              </div>
            ))}
          </CardContent>
        </Card>
        
        <Card className="col-span-2 md:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-blue-800 dark:text-blue-200">Balance</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.entries(balanceTotals).map(([currency, amount]) => (
              <div 
                key={currency} 
                className={`text-2xl font-bold ${amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(Math.abs(amount), currency)}
                <span className="text-sm font-medium">{amount >= 0 ? ' gain' : ' loss'}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(categoryTotals)
            .filter(([_, amounts]) => Object.values(amounts).some(amount => amount !== 0))
            .map(([category, amounts]) => {
              const Icon = CATEGORY_ICONS[category]
              return (
                <div key={category} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon {...{ size: 20, className: "text-gray-500 dark:text-gray-400" } as LucideProps} />
                    <span className="font-medium text-gray-700 dark:text-gray-300">{category}</span>
                  </div>
                  <div className="text-right">
                    {Object.entries(amounts).map(([currency, amount]) => (
                      <div 
                        key={currency}
                        className={`font-semibold ${amount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        {formatCurrency(Math.abs(amount), currency)}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
        </CardContent>
      </Card>
    </div>
  )
} 
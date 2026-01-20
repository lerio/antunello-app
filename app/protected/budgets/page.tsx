"use client"

import { useBudgets, useBudgetProgress } from "@/hooks/useBudgets"
import { BudgetCard } from "@/components/features/budget-card"
import { Button } from "@/components/ui/button"
import { Plus, Loader2 } from "lucide-react"
import Link from "next/link"

export default function BudgetsPage() {
  const { budgets, isLoading: isBudgetsLoading } = useBudgets()
  const { spendingByCategory, isLoading: isProgressLoading } = useBudgetProgress()

  const mapSpendingToBudget = (category: string) => {
    return spendingByCategory[category] || 0
  }

  const isLoading = isBudgetsLoading || isProgressLoading

  return (
    <div>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header matching Home styling */}
        <div className="flex items-center justify-between pt-4 pb-2">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Budgets
            </h2>
          </div>

          {/* Placeholder to match search button height if consistent with other pages, or just empty */}
          <div
            className="p-4.5 border border-transparent rounded-lg w-9 h-9"
            aria-hidden="true"
          ></div>
        </div>

        {/* Content */}
        <div className="py-2 sm:py-6">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {budgets.length === 0 ? (
                <div className="text-center py-10 space-y-4 bg-white dark:bg-gray-800 rounded-xl border shadow-sm">
                  <p className="text-muted-foreground">No budgets set up yet.</p>
                  <Link href="/protected/budgets/add">
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Your First Budget
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {budgets.map((budget) => (
                    <BudgetCard
                      key={budget.id}
                      budget={budget}
                      spent={mapSpendingToBudget(budget.category)}
                      currency="EUR" // Assuming EUR as base
                    />
                  ))}
                </div>
              )}

              {budgets.length > 0 && (
                <div className="flex justify-center pt-4">
                  <Link href="/protected/budgets/add">
                    <Button variant="outline" className="w-full sm:w-auto">
                      <Plus className="mr-2 h-4 w-4" />
                      Add New Budget
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

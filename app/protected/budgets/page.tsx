"use client"

import { useBudgets, useBudgetProgress } from "@/hooks/useBudgets"
import { BudgetCard } from "@/components/features/budget-card"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PageContainer, PageStack } from "@/components/layout/page-container"
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
    <PageContainer>
      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <PageStack>
          {budgets.length === 0 ? (
            <Card className="text-center space-y-4 py-10">
              <p className="text-muted-foreground">No budgets set up yet.</p>
              <Link href="/protected/budgets/add">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Budget
                </Button>
              </Link>
            </Card>
          ) : (
            budgets.map((budget) => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                spent={mapSpendingToBudget(budget.category)}
                currency="EUR"
              />
            ))
          )}

          {budgets.length > 0 && (
            <div className="flex justify-center">
              <Link href="/protected/budgets/add">
                <Button variant="outline" className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Budget
                </Button>
              </Link>
            </div>
          )}
        </PageStack>
      )}
    </PageContainer>
  )
}

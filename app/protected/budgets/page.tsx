"use client"

import { useBudgets, useBudgetProgress } from "@/hooks/useBudgets"
import { BudgetCard } from "@/components/features/budget-card"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PageContainer, PageStack } from "@/components/layout/page-container"
import { BudgetForm } from "@/components/features/budget-form"
import { Modal } from "@/components/ui/modal"
import { FloatingButton } from "@/components/ui/floating-button"
import { Budget } from "@/types/database"
import { Plus, Loader2 } from "lucide-react"
import { useState } from "react"

export default function BudgetsPage() {
  const { budgets, isLoading: isBudgetsLoading } = useBudgets()
  const { spendingByCategory, isLoading: isProgressLoading } = useBudgetProgress()

  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  // The same modal serves both: editingBudget null means "add".
  // It stays set on close so the form stays rendered during the slide-out animation.
  const openEdit = (budget: Budget) => {
    setEditingBudget(budget)
    setIsEditOpen(true)
  }
  const openAdd = () => {
    setEditingBudget(null)
    setIsEditOpen(true)
  }
  const closeEdit = () => setIsEditOpen(false)

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
              <div className="flex justify-center">
                <Button onClick={openAdd}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Budget
                </Button>
              </div>
            </Card>
          ) : (
            budgets.map((budget) => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                spent={mapSpendingToBudget(budget.category)}
                currency="EUR"
                onEdit={openEdit}
              />
            ))
          )}

        </PageStack>
      )}

      <FloatingButton onClick={openAdd} icon={Plus} label="Add budget" />

      <Modal isOpen={isEditOpen} onClose={closeEdit}>
        <BudgetForm
          key={editingBudget?.id ?? "new"}
          mode={editingBudget ? "edit" : "add"}
          initialData={editingBudget ?? undefined}
          existingCategories={budgets
            .filter((b) => b.id !== editingBudget?.id)
            .map((b) => b.category)}
          onClose={closeEdit}
          onDone={closeEdit}
        />
      </Modal>
    </PageContainer>
  )
}

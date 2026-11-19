"use client"

import { BudgetForm } from "@/components/features/budget-form"
import { useBudgets } from "@/hooks/useBudgets"
import { Loader2 } from "lucide-react"
import { PageContainer } from "@/components/layout/page-container"

export default function AddBudgetPage() {
    const { budgets, isLoading } = useBudgets()

    if (isLoading) {
        return (
            <PageContainer className="flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </PageContainer>
        )
    }

    const existingCategories = budgets.map(b => b.category)

    return (
        <PageContainer title="Add Budget">
            <div className="space-y-4 sm:space-y-6">
                <div>
                    <h3 className="text-lg font-medium">Add New Budget</h3>
                    <p className="text-sm text-muted-foreground">
                        Set a monthly spending limit for a category.
                    </p>
                </div>

                <hr className="border-gray-200 dark:border-gray-700" />

                <BudgetForm mode="add" existingCategories={existingCategories} />
            </div>
        </PageContainer>
    )
}

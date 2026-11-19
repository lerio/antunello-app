"use client"

import { BudgetForm } from "@/components/features/budget-form"
import { useBudgets } from "@/hooks/useBudgets"
import { Loader2 } from "lucide-react"
import { PageContainer } from "@/components/layout/page-container"
import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"

export default function EditBudgetPage() {
    const params = useParams()
    const router = useRouter()
    const { budgets, isLoading } = useBudgets()

    // Find budget from cache
    const budgetId = params.id as string
    const budget = budgets.find(b => b.id === budgetId)

    // If not found in cache and not loading, maybe redirect or handle fetched individually?
    // Since useBudgets fetches all, if it's not there after loading, it doesn't exist.

    useEffect(() => {
        if (!isLoading && !budget) {
            // Budget not found
            router.push("/protected/budgets")
        }
    }, [isLoading, budget, router])

    if (isLoading || !budget) {
        return (
            <PageContainer className="flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </PageContainer>
        )
    }

    const existingCategories = budgets.filter(b => b.id !== budgetId).map(b => b.category)

    return (
        <PageContainer title="Edit Budget">
            <div className="space-y-4 sm:space-y-6">
                <div>
                    <h3 className="text-lg font-medium">Edit Budget</h3>
                    <p className="text-sm text-muted-foreground">
                        Update your monthly spending limit for {budget.category}.
                    </p>
                </div>

                <hr className="border-gray-200 dark:border-gray-700" />

                <BudgetForm mode="edit" initialData={budget} existingCategories={existingCategories} />
            </div>
        </PageContainer>
    )
}

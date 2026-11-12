"use client"

import { BudgetForm } from "@/components/features/budget-form"
import { useBudgets } from "@/hooks/useBudgets"
import { Loader2 } from "lucide-react"
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
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    const existingCategories = budgets.filter(b => b.id !== budgetId).map(b => b.category)

    return (
        <div className="mx-auto max-w-3xl px-4 sm:px-6 md:pb-8 lg:px-8">
            <h2 className="hidden md:block pt-4 text-2xl font-bold text-gray-900 dark:text-white">
              Edit Budget
            </h2>

            <div className="space-y-6 py-2 sm:py-6">
                <div>
                    <h3 className="text-lg font-medium">Edit Budget</h3>
                    <p className="text-sm text-muted-foreground">
                        Update your monthly spending limit for {budget.category}.
                    </p>
                </div>

                <hr className="my-4 border-gray-200 dark:border-gray-700" />

                <BudgetForm mode="edit" initialData={budget} existingCategories={existingCategories} />
            </div>
        </div>
    )
}

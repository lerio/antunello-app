"use client"

import { BudgetForm } from "@/components/features/budget-form"
import { useBudgets } from "@/hooks/useBudgets"
import { Loader2 } from "lucide-react"

export default function AddBudgetPage() {
    const { budgets, isLoading } = useBudgets()

    if (isLoading) {
        return (
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    const existingCategories = budgets.map(b => b.category)

    return (
        <div className="mx-auto max-w-3xl px-4 sm:px-6 md:pb-8 lg:px-8">
            <h2 className="hidden md:block pt-4 text-2xl font-bold text-gray-900 dark:text-white">
              Add Budget
            </h2>

            <div className="space-y-6 py-2 sm:py-6">
                <div>
                    <h3 className="text-lg font-medium">Add New Budget</h3>
                    <p className="text-sm text-muted-foreground">
                        Set a monthly spending limit for a category.
                    </p>
                </div>

                <hr className="my-4 border-gray-200 dark:border-gray-700" />

                <BudgetForm mode="add" existingCategories={existingCategories} />
            </div>
        </div>
    )
}

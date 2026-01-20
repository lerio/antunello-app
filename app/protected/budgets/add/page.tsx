"use client"

import { BudgetForm } from "@/components/features/budget-form"
import { useBudgets } from "@/hooks/useBudgets"
import { Loader2 } from "lucide-react"

export default function AddBudgetPage() {
    const { budgets, isLoading } = useBudgets()

    if (isLoading) {
        return (
            <div className="container max-w-2xl py-6 lg:py-10 px-4 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    const existingCategories = budgets.map(b => b.category)

    return (
        <div className="container max-w-2xl py-6 lg:py-10 px-4">
            <div className="space-y-6">
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

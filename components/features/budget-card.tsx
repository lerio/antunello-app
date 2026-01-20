import { Budget } from "@/types/database"
import { formatCurrency } from "@/utils/currency"
import { Edit2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface BudgetCardProps {
    budget: Budget
    spent: number
    currency?: string
}

// Simple Progress component matching the style we want
function SimpleProgress({ value, className }: { value: number, className?: string }) {
    // Ensure value is between 0 and 100
    const clampedValue = Math.min(100, Math.max(0, value))

    // Color logic based on percentage
    let colorClass = "bg-primary"
    if (value > 100) colorClass = "bg-red-500"
    else if (value > 90) colorClass = "bg-amber-500"

    return (
        <div className={`h-2 w-full overflow-hidden rounded-full bg-secondary ${className}`}>
            <div
                className={`h-full flex-1 transition-all ${colorClass}`}
                style={{ width: `${clampedValue}%` }}
            />
        </div>
    )
}

export function BudgetCard({ budget, spent, currency = "EUR" }: BudgetCardProps) {
    const percentage = Math.round((spent / budget.amount) * 100)
    const remaining = budget.amount - spent
    const isOverBudget = remaining < 0

    return (
        <div className="bg-white dark:bg-gray-800 text-card-foreground rounded-xl border shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow">
            <div className="flex flex-row items-center justify-between pb-2">
                <h3 className="text-lg font-semibold m-0">
                    {budget.category}
                </h3>
                <Link href={`/protected/budgets/edit/${budget.id}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                        <Edit2 className="h-4 w-4" />
                        <span className="sr-only">Edit Budget</span>
                    </Button>
                </Link>
            </div>

            <div>
                <div className="flex justify-between items-end mb-2">
                    <div className="text-2xl font-bold">
                        {formatCurrency(budget.amount, currency)}
                    </div>
                    <div className={`text-sm font-medium ${isOverBudget ? 'text-red-500' : 'text-muted-foreground'}`}>
                        {percentage}%
                    </div>
                </div>

                <SimpleProgress value={percentage} className="mb-2" />

                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>Spent: {formatCurrency(Math.abs(spent), currency)}</span>
                    <span className={isOverBudget ? "font-bold text-red-500" : ""}>
                        {isOverBudget ? "Over: " : "Remaining: "}
                        {formatCurrency(Math.abs(remaining), currency)}
                    </span>
                </div>
            </div>
        </div>
    )
}

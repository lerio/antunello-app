import { useState, useEffect } from "react"
import { Budget, MAIN_CATEGORIES } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useBudgetMutations } from "@/hooks/useBudgets"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"
import { Loader2 } from "lucide-react"
import { createClient } from "@/utils/supabase/client"

interface BudgetFormProps {
    initialData?: Budget
    existingCategories?: string[]
    mode: "add" | "edit"
}

export function BudgetForm({ initialData, existingCategories = [], mode }: BudgetFormProps) {
    const router = useRouter()
    const { addBudget, updateBudget, deleteBudget } = useBudgetMutations()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    const [category, setCategory] = useState(initialData?.category || "")
    const [amount, setAmount] = useState(initialData?.amount?.toString() || "")
    const [error, setError] = useState<string | null>(null)

    // Filter available categories
    const availableCategories = MAIN_CATEGORIES.filter(
        cat => !existingCategories.includes(cat) || (initialData && initialData.category === cat)
    ).sort()

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        setIsSubmitting(true)
        setError(null)

        try {
            if (!category) {
                throw new Error("Category is required")
            }
            const parsedAmount = parseFloat(amount)
            if (isNaN(parsedAmount) || parsedAmount <= 0) {
                throw new Error("Amount must be greater than 0")
            }

            if (mode === "add") {
                const supabase = createClient()
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) throw new Error("Not authenticated")

                await addBudget({
                    category,
                    amount: parsedAmount,
                    user_id: user.id
                } as any)
                toast.success("Budget created successfully")
            } else if (initialData) {
                await updateBudget(initialData.id, {
                    amount: parsedAmount,
                    // category is typically not editable, but if we allow it, validation handles it
                    category: category
                })
                toast.success("Budget updated successfully")
            }
            router.push("/protected/budgets")
            router.refresh()
        } catch (err: any) {
            console.error(err)
            setError(err.message || "Something went wrong")
            toast.error(err.message || "Something went wrong")
        } finally {
            setIsSubmitting(false)
        }
    }

    async function onDelete() {
        if (!initialData) return
        if (!confirm("Are you sure you want to delete this budget?")) return

        setIsDeleting(true)
        try {
            await deleteBudget(initialData.id)
            toast.success("Budget deleted")
            router.push("/protected/budgets")
            router.refresh()
        } catch (err) {
            console.error(err)
            toast.error("Failed to delete budget")
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Category
                </label>
                <Select
                    value={category}
                    onValueChange={setCategory}
                    disabled={mode === "edit"}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableCategories.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                                {cat}
                            </SelectItem>
                        ))}
                        {/* If current category is not in available (e.g. somehow glitch), show it anyway in edit mode */}
                        {mode === 'edit' && category && !availableCategories.includes(category) && (
                            <SelectItem key={category} value={category}>
                                {category}
                            </SelectItem>
                        )}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Monthly Limit
                </label>
                <Input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                />
            </div>

            {error && (
                <p className="text-sm text-red-500">{error}</p>
            )}

            <div className="flex gap-4 justify-between pt-4">
                <Button type="button" variant="outline" onClick={() => router.back()}>
                    Cancel
                </Button>
                <div className="flex gap-2">
                    {mode === "edit" && (
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={onDelete}
                            disabled={isDeleting || isSubmitting}
                        >
                            {isDeleting ? <Loader2 className="animate-spin h-4 w-4" /> : "Delete"}
                        </Button>
                    )}
                    <Button type="submit" disabled={isSubmitting || isDeleting || !category || !amount}>
                        {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : (mode === "add" ? "Create Budget" : "Save Changes")}
                    </Button>
                </div>
            </div>
        </form>
    )
}

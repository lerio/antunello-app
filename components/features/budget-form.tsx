import { useState } from "react"
import { Budget } from "@/types/database"
import { useCategories } from "@/hooks/useCategories"
import { useBudgetMutations } from "@/hooks/useBudgets"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"
import { Trash2, AlertCircle } from "lucide-react"
import { CategorySelect } from "@/components/ui/category-select"
import { createClient } from "@/utils/supabase/client"

const inputClass =
    "block w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none text-base h-12 px-4"

interface BudgetFormProps {
    initialData?: Budget
    existingCategories?: string[]
    mode: "add" | "edit"
    /** Called to dismiss the form (Cancel). Defaults to navigating back. */
    onClose?: () => void
    /** Called after a successful save or delete. Defaults to navigating to the budgets list. */
    onDone?: () => void
}

export function BudgetForm({ initialData, existingCategories = [], mode, onClose, onDone }: BudgetFormProps) {
    const router = useRouter()
    const { mainCategories, isCategoryOfType } = useCategories()
    const { addBudget, updateBudget, deleteBudget } = useBudgetMutations()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    const [category, setCategory] = useState(initialData?.category || "")
    const [amount, setAmount] = useState(initialData?.amount?.toString() || "")
    const [error, setError] = useState<string | null>(null)

    // Only expense categories: spending is summed from expenses and excludes
    // transfers, so a budget on an income category or on Money Transfer could
    // never show anything but 0. The category being edited is always kept, even
    // if it predates this rule.
    const availableCategories = mainCategories.filter(
        cat =>
            (initialData && initialData.category === cat) ||
            (isCategoryOfType(cat, "expense") &&
                cat !== "Money Transfer" &&
                !existingCategories.includes(cat))
    ).sort()

    function finish() {
        if (onDone) {
            onDone()
        } else {
            router.push("/protected/budgets")
            router.refresh()
        }
    }

    const close = onClose ?? (() => router.back())

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
            finish()
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

        setIsDeleting(true)
        try {
            await deleteBudget(initialData.id)
            toast.success("Budget deleted")
            finish()
        } catch (err) {
            console.error(err)
            toast.error("Failed to delete budget")
        } finally {
            setIsDeleting(false)
            setShowDeleteConfirm(false)
        }
    }

    const busy = isSubmitting || isDeleting
    const categoryOptions =
        mode === "edit" && category && !availableCategories.includes(category)
            ? [...availableCategories, category]
            : availableCategories

    return (
        <div className="w-full bg-white dark:bg-gray-900 px-4 pt-2 pb-2 sm:px-6 sm:pt-3 sm:pb-6 md:px-8 md:pt-4 md:pb-8 lg:px-12 lg:pt-6 lg:pb-12 font-inter">
            <form onSubmit={onSubmit} noValidate>
                <div className="grid grid-cols-1 gap-y-3">
                    <CategorySelect
                        options={categoryOptions.map((cat) => ({ value: cat, label: cat, isMainCategory: true }))}
                        value={category}
                        onChange={setCategory}
                        placeholder="Category"
                        disabled={mode === "edit" || busy}
                    />

                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 dark:text-gray-400">
                            €
                        </span>
                        <input
                            className={`${inputClass.replaceAll("px-4", "pl-10 pr-4")}`}
                            type="text"
                            inputMode="decimal"
                            placeholder="Monthly limit"
                            aria-label="Monthly limit"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value.replace(",", "."))}
                            disabled={busy}
                            data-lpignore="true"
                        />
                    </div>
                </div>

                {error && (
                    <div className="mt-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3" role="alert">
                        <div className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-400">
                            <AlertCircle size={16} className="flex-shrink-0" />
                            {error}
                        </div>
                    </div>
                )}

                {!showDeleteConfirm && (
                    <div className="mt-3 sm:mt-6 md:mt-8 pb-2">
                        <div className="flex gap-3">
                            <button
                                className={`flex-1 flex justify-center py-4 px-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg text-lg font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all transform hover:scale-105 focus:outline-none ${busy ? "opacity-50 cursor-not-allowed" : ""}`}
                                type="button"
                                onClick={close}
                                disabled={busy}
                            >
                                Cancel
                            </button>
                            <button
                                className={`flex-1 flex justify-center py-4 px-4 border border-transparent rounded-lg shadow-lg text-lg font-semibold text-white transition-all transform hover:scale-105 focus:outline-none bg-black hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 ${busy ? "opacity-50 cursor-not-allowed" : ""}`}
                                type="submit"
                                disabled={busy}
                            >
                                {mode === "add" ? "Add" : "Save"}
                            </button>
                        </div>
                    </div>
                )}
            </form>

            {showDeleteConfirm && (
                <div className="mt-3 sm:mt-6 md:mt-8 pb-2">
                    <div className="flex gap-3">
                        <button
                            className="flex-1 flex justify-center py-4 px-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg text-lg font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all transform hover:scale-105 focus:outline-none"
                            type="button"
                            onClick={() => setShowDeleteConfirm(false)}
                        >
                            Cancel
                        </button>
                        <button
                            className={`flex-1 flex justify-center items-center py-4 px-4 border border-transparent rounded-lg shadow-lg text-lg font-semibold text-white transition-all transform hover:scale-105 focus:outline-none bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 ${isDeleting ? "opacity-50 cursor-not-allowed" : ""}`}
                            type="button"
                            onClick={onDelete}
                            disabled={isDeleting}
                        >
                            <Trash2 size={20} className="mr-2 flex-shrink-0" />
                            Confirm
                        </button>
                    </div>
                </div>
            )}

            {mode === "edit" && (
                <div className="pt-1 pb-1">
                    <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className={`w-full text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:underline transition-colors py-1 focus:outline-none ${showDeleteConfirm ? "invisible pointer-events-none" : ""}`}
                        tabIndex={showDeleteConfirm ? -1 : 0}
                        aria-hidden={showDeleteConfirm}
                    >
                        Delete Budget
                    </button>
                </div>
            )}
        </div>
    )
}

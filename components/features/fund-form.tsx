import { useState } from "react"
import { Trash2, AlertCircle } from "lucide-react"
import { FundCategory, TOP_LEVEL_FUND_CATEGORIES } from "@/types/database"
import { CURRENCIES } from "@/constants/app-constants"
import { CategorySelect } from "@/components/ui/category-select"
import { Switch } from "@/components/ui/switch"

const inputClass =
    "block w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none text-base h-12 px-4"

export interface FundFormValues {
    name: string
    description: string
    currency: string
    amount: number
    is_active: boolean
    top_level_category: string
}

interface FundFormProps {
    /** The fund being edited, or undefined when adding. */
    initialData?: FundCategory
    onSubmit: (values: FundFormValues) => Promise<void>
    onDelete?: () => Promise<void>
    onClose: () => void
}

/** Add or edit a fund, laid out like the transaction and budget forms inside the shared Modal. */
export function FundForm({ initialData, onSubmit, onDelete, onClose }: FundFormProps) {
    const [name, setName] = useState(initialData?.name ?? "")
    const [topLevel, setTopLevel] = useState(initialData?.top_level_category ?? "")
    const [currency, setCurrency] = useState(initialData?.currency ?? "EUR")
    const [amount, setAmount] = useState(initialData ? String(initialData.amount) : "")
    const [description, setDescription] = useState(initialData?.description ?? "")
    const [isActive, setIsActive] = useState(initialData?.is_active ?? true)
    const [error, setError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    const busy = isSubmitting || isDeleting
    const isEdit = !!initialData

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)

        const parsedAmount = Number.parseFloat(amount)
        if (!name.trim()) return setError("Name is required")
        if (Number.isNaN(parsedAmount)) return setError("Initial amount is required")

        setIsSubmitting(true)
        try {
            await onSubmit({
                name: name.trim(),
                description: description.trim(),
                currency,
                amount: parsedAmount,
                is_active: isActive,
                top_level_category: topLevel,
            })
        } catch (err: any) {
            setError(err?.message || "Something went wrong")
        } finally {
            setIsSubmitting(false)
        }
    }

    async function handleDelete() {
        if (!onDelete) return
        setIsDeleting(true)
        try {
            await onDelete()
        } catch (err: any) {
            setError(err?.message || "Failed to delete fund")
            setShowDeleteConfirm(false)
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <div className="w-full bg-white dark:bg-gray-900 px-4 pt-2 pb-2 sm:px-6 sm:pt-3 sm:pb-6 md:px-8 md:pt-4 md:pb-8 lg:px-12 lg:pt-6 lg:pb-12 font-inter">
            <form onSubmit={handleSubmit} noValidate>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                    <div className="md:col-span-2">
                        <input
                            className={inputClass}
                            placeholder="Name"
                            aria-label="Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={busy}
                        />
                    </div>

                    <CategorySelect
                        options={[
                            { value: "", label: "No Category" },
                            ...TOP_LEVEL_FUND_CATEGORIES.map((c) => ({ value: c, label: c })),
                        ]}
                        value={topLevel}
                        onChange={setTopLevel}
                        placeholder="Top level category"
                        disabled={busy}
                    />

                    <CategorySelect
                        options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                        value={currency}
                        onChange={setCurrency}
                        placeholder="Currency"
                        disabled={busy}
                    />

                    <input
                        className={inputClass}
                        type="text"
                        inputMode="decimal"
                        placeholder="Initial amount"
                        aria-label="Initial amount"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value.replace(",", "."))}
                        disabled={busy}
                        data-lpignore="true"
                    />

                    <input
                        className={inputClass}
                        placeholder="Description (optional)"
                        aria-label="Description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        disabled={busy}
                    />

                    <label className="md:col-span-2 flex items-center justify-between h-12 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm text-base text-gray-900 dark:text-gray-100">
                        Active
                        <Switch checked={isActive} onCheckedChange={setIsActive} disabled={busy} />
                    </label>
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
                                onClick={onClose}
                                disabled={busy}
                            >
                                Cancel
                            </button>
                            <button
                                className={`flex-1 flex justify-center py-4 px-4 border border-transparent rounded-lg shadow-lg text-lg font-semibold text-white transition-all transform hover:scale-105 focus:outline-none bg-black hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 ${busy ? "opacity-50 cursor-not-allowed" : ""}`}
                                type="submit"
                                disabled={busy}
                            >
                                {isEdit ? "Save" : "Add"}
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
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            <Trash2 size={20} className="mr-2 flex-shrink-0" />
                            Confirm
                        </button>
                    </div>
                </div>
            )}

            {isEdit && onDelete && !showDeleteConfirm && (
                <div className="pt-1 pb-1">
                    <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="w-full text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:underline transition-colors py-1 focus:outline-none"
                    >
                        Delete Fund
                    </button>
                </div>
            )}
        </div>
    )
}

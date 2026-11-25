import { useState } from "react"
import { AlertCircle, ArrowRightLeft, MinusCircle, PlusCircle, Trash2 } from "lucide-react"
import { IconSelect } from "@/components/ui/icon-select"
import { cn } from "@/lib/utils"
import { getTypeButtonClass } from "@/utils/styling-utils"

const inputClass =
    "block w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none text-base h-12 px-4"

export type CategoryKind = "expense" | "income" | "transfer"

const KINDS = [
    { kind: "expense", label: "Expense", Icon: MinusCircle },
    { kind: "income", label: "Income", Icon: PlusCircle },
    { kind: "transfer", label: "Movement", Icon: ArrowRightLeft },
] as const

interface CategoryFormProps {
    /** Omit to add a new category; then the type is editable too. */
    title?: string
    /** Set when editing a subcategory: its main category's title, shown above the title field. */
    parentTitle?: string
    kind?: CategoryKind
    /** Main categories only: the icon's Lucide component name, e.g. "Utensils". */
    icon?: string
    /** Transactions using this category; shown below the title when editing. Hidden while loading. */
    transactionCount?: number
    /** Edit view only: whether deleting is allowed (nothing depends on the category). */
    canDelete?: boolean
    onDelete?: () => void
    onSubmit: (title: string, kind: CategoryKind, icon: string) => void | Promise<void>
    onClose: () => void
}

/**
 * Add or edit a category or subcategory, laid out like the other modals. The type
 * is shown with the transaction form's type buttons: selectable only when adding a
 * main category, read-only otherwise. The title is always editable.
 */
export function CategoryForm({ title: initialTitle, parentTitle, kind: initialKind, icon: initialIcon, transactionCount, canDelete = false, onDelete, onSubmit, onClose }: CategoryFormProps) {
    const isEdit = initialTitle !== undefined
    // A subcategory is bound to its main category's type, whether new or existing.
    const isTypeLocked = isEdit || parentTitle !== undefined
    const [title, setTitle] = useState(initialTitle ?? "")
    const [icon, setIcon] = useState(initialIcon ?? "")
    const [kind, setKind] = useState<CategoryKind>(initialKind ?? "expense")
    const [error, setError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    // Money Transfer is the only movement and carries special transfer logic, so a
    // new main category can only be income or expense.
    const isMovementLocked = (k: CategoryKind) => k === "transfer" && !isEdit && parentTitle === undefined
    const noun = parentTitle !== undefined ? "Subcategory" : "Category"

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        const trimmed = title.trim()
        if (!trimmed) return setError("Title is required")
        setError(null)
        setIsSubmitting(true)
        try {
            await onSubmit(trimmed, kind, icon)
        } catch (err: any) {
            setError(err?.message || "Something went wrong")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="w-full bg-white dark:bg-gray-900 px-4 pt-2 pb-2 sm:px-6 sm:pt-3 sm:pb-6 md:px-8 md:pt-4 md:pb-8 lg:px-12 lg:pt-6 lg:pb-12 font-inter">
            <form onSubmit={handleSubmit} noValidate>
                <div className="grid grid-cols-1 gap-y-3">
                    <div className="flex space-x-3" role="group" aria-label={isTypeLocked ? "Category type (read-only)" : "Category type"}>
                        {KINDS.map(({ kind: k, label, Icon }) => (
                            <button
                                key={k}
                                type="button"
                                disabled={isTypeLocked || isMovementLocked(k)}
                                onClick={() => setKind(k)}
                                aria-pressed={k === kind}
                                title={label}
                                className={cn(
                                    getTypeButtonClass(k, k === kind, false),
                                    isTypeLocked && "cursor-default",
                                    isTypeLocked && k !== kind && "opacity-50",
                                    !isTypeLocked && isMovementLocked(k) && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                <Icon size={20} />
                            </button>
                        ))}
                    </div>

                    {parentTitle && (
                        <div className="text-base font-semibold text-gray-900 dark:text-gray-100 px-1">
                            {parentTitle}
                        </div>
                    )}

                    <input
                        className={inputClass}
                        placeholder={parentTitle ? "Subcategory title" : "Title"}
                        aria-label="Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />

                    {isEdit && transactionCount !== undefined && (
                        <p className="m-0 px-1 text-sm text-gray-500 dark:text-gray-400">
                            {transactionCount} {transactionCount === 1 ? "transaction" : "transactions"}
                        </p>
                    )}

                    {parentTitle === undefined && (
                        <IconSelect value={icon} onChange={setIcon} placeholder="Icon" />
                    )}
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
                            className="flex-1 flex justify-center py-4 px-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg text-lg font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all transform hover:scale-105 focus:outline-none"
                            type="button"
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                        <button
                            className="flex-1 flex justify-center py-4 px-4 border border-transparent rounded-lg shadow-lg text-lg font-semibold text-white transition-all transform hover:scale-105 focus:outline-none bg-black hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700"
                            type="submit"
                            disabled={isSubmitting}
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
                            className="flex-1 flex justify-center items-center py-4 px-4 border border-transparent rounded-lg shadow-lg text-lg font-semibold text-white transition-all transform hover:scale-105 focus:outline-none bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
                            type="button"
                            onClick={() => {
                                onDelete?.()
                                setShowDeleteConfirm(false)
                            }}
                        >
                            <Trash2 size={20} className="mr-2 flex-shrink-0" />
                            Confirm
                        </button>
                    </div>
                </div>
            )}

            {isEdit && !showDeleteConfirm && (
                <div className="pt-1 pb-1">
                    <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={!canDelete}
                        title={canDelete ? undefined : parentTitle !== undefined
                            ? "Only subcategories with no transactions can be deleted"
                            : "Only categories with no subcategories and no transactions can be deleted"}
                        className="w-full text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:underline transition-colors py-1 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
                    >
                        Delete {noun}
                    </button>
                </div>
            )}
        </div>
    )
}

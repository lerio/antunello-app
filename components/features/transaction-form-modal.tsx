import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { MAIN_CATEGORIES, SUB_CATEGORIES, Transaction, CATEGORIES_WITH_TYPES, getCategoryType, TitleSuggestion } from "@/types/database";
import { createClient } from "@/utils/supabase/client";
import { parseNumber, isValidPositiveNumber } from "@/utils/number";
import {
  MinusCircle,
  PlusCircle,
  Calendar,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ValidationTooltip } from "@/components/ui/validation-tooltip";
import { CategorySelect } from "@/components/ui/category-select";
import { TitleSuggestionInput } from "@/components/ui/title-suggestion-input";
import { useFundCategories } from "@/hooks/useFundCategories";
import { useFormFieldProtection } from "@/hooks/useFormFieldProtection";
import styles from "./transaction-form-modal.module.css";

function renderSubmitButtonContent(
  isLoading: boolean,
  hasInitialData: boolean,
  transactionType: "expense" | "income"
): React.ReactNode {
  return hasInitialData ? "Save" : "Add";
}

// Helper: button styles for type toggle
const getTypeButtonColorClass = (
  type: "expense" | "income",
  isSelected: boolean
): string => {
  if (type === "expense") {
    return isSelected
      ? "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-500 dark:border-red-400"
      : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-gray-200 dark:border-gray-600 hover:bg-red-100 dark:hover:bg-red-900/40 hover:border-red-400 dark:hover:border-red-400";
  }
  return isSelected
    ? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-500 dark:border-green-400"
    : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-gray-200 dark:border-gray-600 hover:bg-green-100 dark:hover:bg-green-900/40 hover:border-green-400 dark:hover:border-green-400";
};

const getTypeButtonClass = (
  type: "expense" | "income",
  isSelected: boolean
) => {
  const baseClass =
    "flex-1 py-3 px-4 rounded-lg flex items-center justify-center font-medium border-2 transition-all";
  const colorClass = getTypeButtonColorClass(type, isSelected);
  return `${baseClass} ${colorClass}`;
};

// Subcomponent: Type selector toggle
function TypeSelector({
  transactionType,
  setTransactionType,
  disabled,
}: {
  readonly transactionType: "expense" | "income";
  readonly setTransactionType: React.Dispatch<
    React.SetStateAction<"expense" | "income">
  >;
  readonly disabled: boolean;
}) {
  return (
    <div>
      <div className="flex space-x-4">
        <button
          className={`${getTypeButtonClass(
            "expense",
            transactionType === "expense"
          )} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          type="button"
          onClick={() => !disabled && setTransactionType("expense")}
          disabled={disabled}
        >
          <MinusCircle size={20} className="mr-2" />
          Expense
        </button>
        <button
          className={`${getTypeButtonClass(
            "income",
            transactionType === "income"
          )} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          type="button"
          onClick={() => !disabled && setTransactionType("income")}
          disabled={disabled}
        >
          <PlusCircle size={20} className="mr-2" />
          Income
        </button>
      </div>
    </div>
  );
}

// Subcomponent: Delete section
function DeleteSection({
  initialData,
  onDelete,
  showDeleteConfirm,
  setShowDeleteConfirm,
}: {
  readonly initialData?: Transaction;
  readonly onDelete?: (transaction: Transaction) => Promise<void>;
  readonly showDeleteConfirm: boolean;
  readonly setShowDeleteConfirm: (v: boolean) => void;
}) {
  if (!onDelete || !initialData) return null;
  return (
    <div className="pt-1 pb-1">
      <button
        onClick={() => setShowDeleteConfirm(true)}
        className={`w-full text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:underline transition-colors py-1 focus:outline-none ${showDeleteConfirm ? "invisible pointer-events-none" : ""
          }`}
        tabIndex={showDeleteConfirm ? -1 : 0}
        aria-hidden={showDeleteConfirm}
      >
        Delete Transaction
      </button>
    </div>
  );
}

interface TransactionFormModalProps {
  readonly onSubmit: (
    data: Omit<Transaction, "id" | "created_at" | "updated_at">
  ) => Promise<void>;
  readonly initialData?: Transaction;
  readonly disabled?: boolean;
  readonly onDelete?: (transaction: Transaction) => Promise<void>;
  readonly onClose?: () => void;
}

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD", symbol: "$" },
  { value: "EUR", label: "EUR", symbol: "€" },
  { value: "JPY", label: "JPY", symbol: "¥" },
] as const;

export default function TransactionFormModal({
  onSubmit,
  initialData,
  disabled = false,
  onDelete,
  onClose,
}: TransactionFormModalProps) {
  // Get fund categories for the Source dropdown
  const { fundCategories, isLoading: fundCategoriesLoading } =
    useFundCategories();

  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [mainCategory, setMainCategory] = useState(
    initialData?.main_category || ""
  );
  const [subCategory, setSubCategory] = useState(
    initialData?.sub_category || ""
  );
  const [transactionType, setTransactionType] = useState<"expense" | "income">(
    initialData?.type || "expense"
  );

  // Reset main category when transaction type changes if current category is not valid for the new type
  useEffect(() => {
    if (mainCategory && getCategoryType(mainCategory) !== transactionType) {
      setMainCategory("");
      setSubCategory("");
    }
  }, [transactionType, mainCategory]);
  const [selectedCurrency, setSelectedCurrency] = useState(
    initialData?.currency || "EUR"
  );
  const [selectedDate, setSelectedDate] = useState<Date>(
    initialData?.date ? new Date(initialData.date) : new Date()
  );
  const [selectedFundCategoryId, setSelectedFundCategoryId] = useState<
    string | null
  >(initialData?.fund_category_id || null);

  // Title suggestion state
  const [title, setTitle] = useState(initialData?.title || "");
  const [autoFilledFields, setAutoFilledFields] = useState<{
    type: boolean;
    mainCategory: boolean;
    subCategory: boolean;
  }>({
    type: false,
    mainCategory: false,
    subCategory: false
  });

  // Handle title suggestion selection
  const handleSuggestionSelect = useCallback((suggestion: TitleSuggestion) => {
    // Auto-fill the fields from the suggestion
    setTransactionType(suggestion.type);
    setMainCategory(suggestion.main_category);
    setSubCategory(suggestion.sub_category || "");

    // Mark fields as auto-filled for visual feedback
    setAutoFilledFields({
      type: true,
      mainCategory: true,
      subCategory: !!suggestion.sub_category
    });
  }, []);

  // Reset auto-fill indicators when user manually changes fields
  const handleTypeChange = useCallback((type: React.SetStateAction<"expense" | "income">) => {
    setTransactionType(type);
    setAutoFilledFields(prev => ({ ...prev, type: false }));
  }, []);

  const handleCategoryChange = useCallback((value: string) => {
    setMainCategory(value);
    setSubCategory(""); // Reset sub category when main category changes
    setAutoFilledFields(prev => ({
      ...prev,
      mainCategory: false,
      subCategory: false
    }));
  }, []);

  const handleSubCategoryChange = useCallback((value: string) => {
    setSubCategory(value);
    setAutoFilledFields(prev => ({ ...prev, subCategory: false }));
  }, []);

  // Protect amount field from browser extension errors
  useFormFieldProtection('amount');

  // Additional aggressive protection for 1Password
  useEffect(() => {
    const amountField = document.getElementById('amount') as HTMLInputElement;
    if (!amountField) return;

    // Add a more aggressive protection by wrapping the field in a proxy
    const originalFocus = amountField.focus;
    amountField.focus = function (options?: FocusOptions) {
      // Add defensive properties before calling focus
      try {
        Object.defineProperty(this, 'control', { value: this, writable: false, configurable: true });
        Object.defineProperty(this, 'form', { value: this.closest('form'), writable: false, configurable: true });
        Object.defineProperty(this, 'ownerDocument', { value: document, writable: false, configurable: true });
      } catch (error) {
        // Ignore errors
      }

      return originalFocus.call(this, options);
    };

    return () => {
      if (amountField.focus === originalFocus) return;
      amountField.focus = originalFocus;
    };
  }, []);

  // Validation state for tooltips
  const [hideFromTotals, setHideFromTotals] = useState(
    initialData?.hide_from_totals || false
  );
  const hideFromTotalsRef = useRef(initialData?.hide_from_totals || false);

  const updateHideFromTotals = useCallback((value: boolean) => {
    setHideFromTotals(value);
    hideFromTotalsRef.current = value;
  }, []);

  // Validation state for tooltips
  const [validationErrors, setValidationErrors] = useState({
    amount: "",
    mainCategory: "",
    subCategory: "",
    title: "",
  });

  const { currencySymbol, mainCategoryOptions, subCategoryOptions } = useMemo(
    () => ({
      subCategories:
        SUB_CATEGORIES[mainCategory as keyof typeof SUB_CATEGORIES] || [],
      currencySymbol:
        CURRENCY_OPTIONS.find((c) => c.value === selectedCurrency)?.symbol ||
        "€",
      mainCategoryOptions: CATEGORIES_WITH_TYPES
        .filter(cat => cat.type === transactionType)
        .map((category) => ({
          value: category.category,
          label: category.category,
          isMainCategory: true,
        })),
      subCategoryOptions: (
        SUB_CATEGORIES[mainCategory as keyof typeof SUB_CATEGORIES] || []
      ).map((category) => ({
        value: category,
        label: category,
        isMainCategory: false,
      })),
    }),
    [mainCategory, selectedCurrency, transactionType]
  );

  // Helper to validate form fields
  const validateFormFields = (
    amount: string,
    mainCategory: string,
    subCategory: string,
    title: string
  ) => {
    const newErrors = {
      amount: "",
      mainCategory: "",
      subCategory: "",
      title: "",
    };

    if (!isValidPositiveNumber(amount)) {
      newErrors.amount = "Please enter a valid amount";
    }

    if (!mainCategory) {
      newErrors.mainCategory = "Please select a main category";
    }

    if (!subCategory?.trim()) {
      newErrors.subCategory = "Please select a sub category";
    }

    if (!title?.trim()) {
      newErrors.title = "Please enter a title";
    }

    return newErrors;
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      // Clear previous validation errors
      setValidationErrors({
        amount: "",
        mainCategory: "",
        subCategory: "",
        title: "",
      });

      // Validate all required fields
      const formData = new FormData(e.currentTarget);
      const amount = formData.get("amount") as string;
      const title = formData.get("title") as string;
      const formMainCategory = formData.get("main_category") as string;
      const formSubCategory = formData.get("sub_category") as string;

      const newErrors = validateFormFields(
        amount,
        formMainCategory,
        formSubCategory,
        title
      );
      const hasErrors = Object.values(newErrors).some((error) => error !== "");

      if (hasErrors) {
        setValidationErrors(newErrors);
        // Auto-dismiss tooltips after 4 seconds
        setTimeout(() => {
          setValidationErrors({
            amount: "",
            mainCategory: "",
            subCategory: "",
            title: "",
          });
        }, 4000);
        return;
      }

      setIsLoading(true);

      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user?.id) throw new Error("User not authenticated");

        const submitData = {
          user_id: user.id,
          amount: parseNumber(formData.get("amount") as string),
          currency: selectedCurrency,
          type: transactionType,
          main_category: mainCategory,
          sub_category: subCategory,
          title: formData.get("title") as string,
          date: selectedDate.toISOString(),
          hide_from_totals: hideFromTotalsRef.current,
          fund_category_id: selectedFundCategoryId,
        };


        await onSubmit(submitData);
      } catch (error) {
        console.error("Form submission failed:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [
      onSubmit,
      transactionType,
      selectedCurrency,
      selectedDate,
      mainCategory,
      subCategory,
      selectedFundCategoryId,
    ]
  );


  const handleCurrencyChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedCurrency(e.target.value);
    },
    []
  );

  // Reusable class strings
  const inputClass =
    "block w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none text-base h-12 px-4";

  const buttonContent = renderSubmitButtonContent(
    isLoading,
    !!initialData,
    transactionType
  );

  return (
    <div
      className={`${styles.root} w-full bg-white dark:bg-gray-900 px-4 pt-2 pb-2 sm:px-6 sm:pt-3 sm:pb-6 md:px-8 md:pt-4 md:pb-8 lg:px-12 lg:pt-6 lg:pb-12 font-inter`}
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
          {/* Amount and Source - Side by side on desktop */}
          <div className="md:col-span-2 flex flex-col md:flex-row gap-3">
            {/* Amount with Currency and Hide Toggle */}
            <div className="flex gap-3 flex-1">
              <div className="flex-1" style={{ width: "75%" }}>
                <ValidationTooltip
                  message={validationErrors.amount}
                  isVisible={!!validationErrors.amount}
                  onClose={() =>
                    setValidationErrors((prev) => ({ ...prev, amount: "" }))
                  }
                >
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 dark:text-gray-400">
                      {currencySymbol}
                    </span>
                    <input
                      className={`${inputClass.replaceAll(
                        "px-4",
                        "pl-10 pr-20"
                      )} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                      id="amount"
                      name="amount"
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9]*[.,]?[0-9]*"
                      placeholder="Amount"
                      defaultValue={initialData?.amount}
                      autoComplete="transaction-amount"
                      data-lpignore="true"
                      disabled={disabled}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center">
                      <select
                        className={`h-full py-0 pl-2 pr-7 border-transparent bg-transparent text-gray-500 dark:text-gray-400 focus:outline-none text-base rounded-md form-select ${disabled ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                        id="currency"
                        name="currency"
                        value={selectedCurrency}
                        onChange={handleCurrencyChange}
                        aria-label="Currency selection"
                        disabled={disabled}
                      >
                        {CURRENCY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </ValidationTooltip>
              </div>

              {/* Hide Toggle Eye Icon */}
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => updateHideFromTotals(!hideFromTotals)}
                  className={`h-12 px-3 flex items-center justify-center rounded-lg border transition-colors ${hideFromTotals
                    ? "bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400"
                    : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                  disabled={disabled}
                  title={
                    hideFromTotals
                      ? "Hidden from monthly totals"
                      : "Visible in monthly totals"
                  }
                >
                  {hideFromTotals ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Source (Fund Category) */}
            <div className="flex-1">
              <select
                className={`${inputClass} ${disabled ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                id="fund_category_id"
                name="fund_category_id"
                value={selectedFundCategoryId || ""}
                onChange={(e) => {
                  setSelectedFundCategoryId(e.target.value || null);
                }}
                disabled={disabled || fundCategoriesLoading}
              >
                <option value="">No Source</option>
                {fundCategories
                  .filter((fund) => fund.is_active)
                  .map((fund) => (
                    <option key={fund.id} value={fund.id}>
                      {fund.name} ({fund.currency})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Title with Suggestions */}
          <div className="md:col-span-2">
            <ValidationTooltip
              message={validationErrors.title}
              isVisible={!!validationErrors.title}
              onClose={() =>
                setValidationErrors((prev) => ({ ...prev, title: "" }))
              }
            >
              <div>
                <TitleSuggestionInput
                  value={title}
                  onChange={setTitle}
                  onSuggestionSelect={handleSuggestionSelect}
                  placeholder="Enter transaction title..."
                  disabled={disabled}
                  minLength={2}
                  id="title"
                  name="title"
                />
              </div>
            </ValidationTooltip>
          </div>

          {/* Transaction Type */}
          <div className="relative">
            <TypeSelector
              transactionType={transactionType}
              setTransactionType={handleTypeChange}
              disabled={disabled}
            />
            {autoFilledFields.type && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-sm" />
            )}
          </div>

          {/* Main Category */}
          <div className="relative">
            <ValidationTooltip
              message={validationErrors.mainCategory}
              isVisible={!!validationErrors.mainCategory}
              onClose={() =>
                setValidationErrors((prev) => ({ ...prev, mainCategory: "" }))
              }
            >
              <div>
                <CategorySelect
                  options={mainCategoryOptions}
                  value={mainCategory}
                  onChange={handleCategoryChange}
                  placeholder="Main Category"
                  disabled={disabled}
                />
                {/* Hidden input for form submission */}
                <input
                  type="hidden"
                  name="main_category"
                  value={mainCategory}
                />
              </div>
            </ValidationTooltip>
            {autoFilledFields.mainCategory && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-sm" />
            )}
          </div>

          {/* Sub Category */}
          <div className="relative">
            <ValidationTooltip
              message={validationErrors.subCategory}
              isVisible={!!validationErrors.subCategory}
              onClose={() =>
                setValidationErrors((prev) => ({ ...prev, subCategory: "" }))
              }
            >
              <div>
                <CategorySelect
                  options={subCategoryOptions}
                  value={subCategory}
                  onChange={handleSubCategoryChange}
                  placeholder="Sub Category"
                  disabled={disabled || !mainCategory}
                  key={mainCategory}
                />
                {/* Hidden input for form submission */}
                <input type="hidden" name="sub_category" value={subCategory} />
              </div>
            </ValidationTooltip>
            {autoFilledFields.subCategory && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-sm" />
            )}
          </div>

          {/* Date */}
          <div>
            <div className="relative">
              <DatePicker
                selected={selectedDate}
                onChange={(date) =>
                  !disabled && setSelectedDate(date || new Date())
                }
                showTimeSelect
                timeFormat="HH:mm"
                timeIntervals={15}
                dateFormat="dd/MM/yyyy HH:mm"
                className={`${inputClass} ${disabled ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                placeholderText="Date"
                popperClassName="z-50"
                calendarClassName="shadow-lg border border-gray-200 dark:border-gray-600 rounded-lg"
                wrapperClassName="w-full"
                id="date-picker"
                name="date-picker"
                disabled={disabled}
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <Calendar
                  size={20}
                  className="text-gray-400 dark:text-gray-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Submit and Cancel Buttons */}
        <div className="mt-3 sm:mt-6 md:mt-8 pb-2">
          <div className="flex gap-3">
            {showDeleteConfirm ? (
              <>
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
                  onClick={async () => {
                    if (onDelete && initialData) {
                      await onDelete(initialData);
                      setShowDeleteConfirm(false);
                    }
                  }}
                >
                  <Trash2 size={20} className="mr-2 flex-shrink-0" />
                  Confirm
                </button>
              </>
            ) : (
              <>
                <button
                  className={`flex-1 flex justify-center py-4 px-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg text-lg font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all transform hover:scale-105 focus:outline-none ${isLoading || disabled ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  type="button"
                  onClick={onClose}
                  disabled={isLoading || disabled}
                >
                  Cancel
                </button>
                <button
                  className={`flex-1 flex justify-center py-4 px-4 border border-transparent rounded-lg shadow-lg text-lg font-semibold text-white transition-all transform hover:scale-105 focus:outline-none bg-black hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 ${isLoading || disabled ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  type="submit"
                  disabled={isLoading || disabled}
                >
                  {buttonContent}
                </button>
              </>
            )}
          </div>
        </div>
      </form>

      {/* Delete Section - Only show for existing transactions */}
      <DeleteSection
        initialData={initialData}
        onDelete={onDelete}
        showDeleteConfirm={showDeleteConfirm}
        setShowDeleteConfirm={setShowDeleteConfirm}
      />
    </div>
  );
}

import { useState, useCallback, useMemo, useRef } from "react";
import { MAIN_CATEGORIES, SUB_CATEGORIES, Transaction } from "@/types/database";
import { createClient } from "@/utils/supabase/client";
import { MinusCircle, PlusCircle, Calendar, Trash2, Eye, EyeOff } from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ValidationTooltip } from "@/components/ui/validation-tooltip";
import { CategorySelect } from "@/components/ui/category-select";
import { useFundCategories } from "@/hooks/useFundCategories";
import styles from "./transaction-form-html-design.module.css";

function renderSubmitButtonContent(
  isLoading: boolean,
  hasInitialData: boolean,
  transactionType: "expense" | "income"
): React.ReactNode {
  if (isLoading) {
    const text = hasInitialData ? "Saving Changes..." : "Adding Transaction...";
    return (
      <div className="flex items-center">
        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
        {text}
      </div>
    );
  }
  if (hasInitialData) {
    return "Save Changes";
  }
  const typeLabel = transactionType === "expense" ? "Expense" : "Income";
  return `Add ${typeLabel}`;
}

// Helper: button styles for type toggle
const getTypeButtonColorClass = (type: 'expense' | 'income', isSelected: boolean): string => {
  if (type === 'expense') {
    return isSelected
      ? "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-500 dark:border-red-400"
      : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-gray-200 dark:border-gray-600 hover:bg-red-100 dark:hover:bg-red-900/40 hover:border-red-400 dark:hover:border-red-400";
  }
  return isSelected
    ? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-500 dark:border-green-400"
    : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-gray-200 dark:border-gray-600 hover:bg-green-100 dark:hover:bg-green-900/40 hover:border-green-400 dark:hover:border-green-400";
};

const getTypeButtonClass = (type: 'expense' | 'income', isSelected: boolean) => {
  const baseClass = "flex-1 py-3 px-4 rounded-lg flex items-center justify-center font-medium border-2 transition-all";
  const colorClass = getTypeButtonColorClass(type, isSelected);
  return `${baseClass} ${colorClass}`;
};

// Subcomponent: Type selector toggle
function TypeSelector({ transactionType, setTransactionType, disabled }: {
  readonly transactionType: 'expense' | 'income';
  readonly setTransactionType: React.Dispatch<React.SetStateAction<'expense' | 'income'>>;
  readonly disabled: boolean;
}) {
  return (
    <div>
      <div className="flex space-x-4">
        <button
          className={`${getTypeButtonClass('expense', transactionType === 'expense')} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          type="button"
          onClick={() => !disabled && setTransactionType('expense')}
          disabled={disabled}
        >
          <MinusCircle size={20} className="mr-2" />
          Expense
        </button>
        <button
          className={`${getTypeButtonClass('income', transactionType === 'income')} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          type="button"
          onClick={() => !disabled && setTransactionType('income')}
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
function DeleteSection({ initialData, onDelete, showDeleteConfirm, setShowDeleteConfirm }: {
  readonly initialData?: Transaction;
  readonly onDelete?: (transaction: Transaction) => Promise<void>;
  readonly showDeleteConfirm: boolean;
  readonly setShowDeleteConfirm: (v: boolean) => void;
}) {
  if (!onDelete || !initialData) return null;
  return (
    <div className="pb-2">
      {showDeleteConfirm ? (
        <div className="flex gap-3">
          <button
            onClick={async () => {
              await onDelete(initialData);
              setShowDeleteConfirm(false);
            }}
            className="flex-1 flex items-center justify-center py-4 px-4 border border-transparent rounded-lg shadow-lg text-lg font-semibold text-white transition-all transform hover:scale-105 focus:outline-none bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
          >
            <Trash2 size={20} className="mr-2 flex-shrink-0" />
            Confirm
          </button>
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="flex-1 flex items-center justify-center py-4 px-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg text-lg font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all transform hover:scale-105 focus:outline-none"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full flex items-center justify-center py-4 px-4 border border-transparent rounded-lg shadow-lg text-lg font-semibold text-white transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 focus:ring-red-500 dark:focus:ring-red-400"
        >
          <Trash2 size={20} className="mr-2 flex-shrink-0" />
          Delete Transaction
        </button>
      )}
    </div>
  );
}

interface TransactionFormModalProps {
  readonly onSubmit: (data: Omit<Transaction, "id" | "created_at" | "updated_at">) => Promise<void>;
  readonly initialData?: Transaction;
  readonly disabled?: boolean;
  readonly onDelete?: (transaction: Transaction) => Promise<void>;
}

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD", symbol: "$" },
  { value: "EUR", label: "EUR", symbol: "€" },
  { value: "JPY", label: "JPY", symbol: "¥" },
] as const;

export default function TransactionFormModal({ onSubmit, initialData, disabled = false, onDelete }: TransactionFormModalProps) {
  // Get fund categories for the Source dropdown
  const { fundCategories, isLoading: fundCategoriesLoading } = useFundCategories();

  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [mainCategory, setMainCategory] = useState(initialData?.main_category || "");
  const [subCategory, setSubCategory] = useState(initialData?.sub_category || "");
  const [transactionType, setTransactionType] = useState<"expense" | "income">(initialData?.type || "expense");
  const [selectedCurrency, setSelectedCurrency] = useState(initialData?.currency || "EUR");
  const [selectedDate, setSelectedDate] = useState<Date>(
    initialData?.date ? new Date(initialData.date) : new Date()
  );
  const [selectedFundCategoryId, setSelectedFundCategoryId] = useState<string | null>(initialData?.fund_category_id || null);


  // Validation state for tooltips
  const [hideFromTotals, setHideFromTotals] = useState(initialData?.hide_from_totals || false);
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
    title: ""
  });

  const { currencySymbol, mainCategoryOptions, subCategoryOptions } = useMemo(() => ({
    subCategories: SUB_CATEGORIES[mainCategory as keyof typeof SUB_CATEGORIES] || [],
    currencySymbol: CURRENCY_OPTIONS.find(c => c.value === selectedCurrency)?.symbol || "€",
    mainCategoryOptions: MAIN_CATEGORIES.map(category => ({
      value: category,
      label: category,
      isMainCategory: true
    })),
    subCategoryOptions: (SUB_CATEGORIES[mainCategory as keyof typeof SUB_CATEGORIES] || []).map(category => ({
      value: category,
      label: category,
      isMainCategory: false
    }))
  }), [mainCategory, selectedCurrency]);

  // Helper to validate form fields
  const validateFormFields = (amount: string, mainCategory: string, subCategory: string, title: string) => {
    const newErrors = { amount: "", mainCategory: "", subCategory: "", title: "" };

    if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
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

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Clear previous validation errors
    setValidationErrors({ amount: "", mainCategory: "", subCategory: "", title: "" });

    // Validate all required fields
    const formData = new FormData(e.currentTarget);
    const amount = formData.get("amount") as string;
    const title = formData.get("title") as string;
    const formMainCategory = formData.get("main_category") as string;
    const formSubCategory = formData.get("sub_category") as string;

    const newErrors = validateFormFields(amount, formMainCategory, formSubCategory, title);
    const hasErrors = Object.values(newErrors).some(error => error !== "");

    if (hasErrors) {
      setValidationErrors(newErrors);
      // Auto-dismiss tooltips after 4 seconds
      setTimeout(() => {
        setValidationErrors({ amount: "", mainCategory: "", subCategory: "", title: "" });
      }, 4000);
      return;
    }
    
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user?.id) throw new Error("User not authenticated");

      const submitData = {
        user_id: user.id,
        amount: Number(formData.get("amount")),
        currency: selectedCurrency,
        type: transactionType,
        main_category: mainCategory,
        sub_category: subCategory,
        title: formData.get("title") as string,
        date: selectedDate.toISOString(),
        hide_from_totals: hideFromTotalsRef.current,
        fund_category_id: selectedFundCategoryId,
      };

      console.log("Form submitting data:", submitData);

      await onSubmit(submitData);
    } catch (error) {
      console.error("Form submission failed:", error);
    } finally {
      setIsLoading(false);
    }
  }, [onSubmit, transactionType, selectedCurrency, selectedDate, mainCategory, subCategory, selectedFundCategoryId]);

  const handleCategoryChange = useCallback((value: string) => {
    setMainCategory(value);
    setSubCategory(""); // Reset sub category when main category changes
  }, []);

  const handleSubCategoryChange = useCallback((value: string) => {
    setSubCategory(value);
  }, []);

  const handleCurrencyChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCurrency(e.target.value);
  }, []);

  // Reusable class strings
  const inputClass = "block w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none text-base h-12 px-4";
  
  const buttonContent = renderSubmitButtonContent(isLoading, !!initialData, transactionType);
  
  return (
    <div className={`${styles.root} w-full bg-white dark:bg-gray-900 px-4 pt-2 pb-4 sm:px-6 sm:pt-3 sm:pb-6 md:px-8 md:pt-4 md:pb-8 lg:px-12 lg:pt-6 lg:pb-12 font-inter`}>

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
          {/* Amount with Currency and Hide Toggle */}
          <div className="flex gap-3">
            <div className="flex-1" style={{ width: '75%' }}>
              <ValidationTooltip
                message={validationErrors.amount}
                isVisible={!!validationErrors.amount}
                onClose={() => setValidationErrors(prev => ({ ...prev, amount: "" }))}
              >
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 dark:text-gray-400">
                    {currencySymbol}
                  </span>
                  <input
                    className={`${inputClass.replaceAll('px-4', 'pl-10 pr-20')} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    id="amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    placeholder="Amount"
                    defaultValue={initialData?.amount}
                    autoComplete="off"
                    disabled={disabled}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center">
                    <select
                      className={`h-full py-0 pl-2 pr-7 border-transparent bg-transparent text-gray-500 dark:text-gray-400 focus:outline-none text-base rounded-md form-select ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      id="currency"
                      name="currency"
                      value={selectedCurrency}
                      onChange={handleCurrencyChange}
                      aria-label="Currency selection"
                      disabled={disabled}
                    >
                      {CURRENCY_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
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
                className={`h-12 px-3 flex items-center justify-center rounded-lg border transition-colors ${
                  hideFromTotals
                    ? 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={disabled}
                title={hideFromTotals ? 'Hidden from monthly totals' : 'Visible in monthly totals'}
              >
                {hideFromTotals ? (
                  <EyeOff size={20} />
                ) : (
                  <Eye size={20} />
                )}
              </button>
            </div>
          </div>

          {/* Transaction Type */}
          <TypeSelector transactionType={transactionType} setTransactionType={setTransactionType} disabled={disabled} />

          {/* Main Category */}
          <div>
            <ValidationTooltip
              message={validationErrors.mainCategory}
              isVisible={!!validationErrors.mainCategory}
              onClose={() => setValidationErrors(prev => ({ ...prev, mainCategory: "" }))}
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
          </div>

          {/* Sub Category */}
          <div>
            <ValidationTooltip
              message={validationErrors.subCategory}
              isVisible={!!validationErrors.subCategory}
              onClose={() => setValidationErrors(prev => ({ ...prev, subCategory: "" }))}
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
                <input
                  type="hidden"
                  name="sub_category"
                  value={subCategory}
                />
              </div>
            </ValidationTooltip>
          </div>

          {/* Title */}
          <div className="md:col-span-2">
            <ValidationTooltip
              message={validationErrors.title}
              isVisible={!!validationErrors.title}
              onClose={() => setValidationErrors(prev => ({ ...prev, title: "" }))}
            >
              <input
                className={`${inputClass} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                id="title"
                name="title"
                placeholder="Title"
                type="text"
                defaultValue={initialData?.title}
                autoComplete="off"
                disabled={disabled}
              />
            </ValidationTooltip>
          </div>

          {/* Date */}
          <div>
            <div className="relative">
              <DatePicker
                selected={selectedDate}
                onChange={(date) => !disabled && setSelectedDate(date || new Date())}
                showTimeSelect
                timeFormat="HH:mm"
                timeIntervals={15}
                dateFormat="dd/MM/yyyy HH:mm"
                className={`${inputClass} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                placeholderText="Date"
                popperClassName="z-50"
                calendarClassName="shadow-lg border border-gray-200 dark:border-gray-600 rounded-lg"
                wrapperClassName="w-full"
                id="date-picker"
                name="date-picker"
                disabled={disabled}
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <Calendar size={20} className="text-gray-400 dark:text-gray-500" />
              </div>
            </div>
          </div>

          {/* Source (Fund Category) */}
          <div>
            <select
              className={`${inputClass} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              id="fund_category_id"
              name="fund_category_id"
              value={selectedFundCategoryId || ""}
              onChange={(e) => {
                console.log("Dropdown onChange triggered:", e.target.value);
                setSelectedFundCategoryId(e.target.value || null);
              }}
              disabled={disabled || fundCategoriesLoading}
            >
              <option value="">No Source (Doesn't affect balance)</option>
              {fundCategories
                .filter(fund => fund.is_active)
                .map((fund) => (
                  <option key={fund.id} value={fund.id}>
                    {fund.name} ({fund.currency})
                  </option>
                ))}
            </select>
          </div>

        </div>

        {/* Submit Button */}
        <div className="mt-6 sm:mt-8 md:mt-12 pb-2">
          <button
            className={`w-full flex justify-center py-4 px-4 border border-transparent rounded-lg shadow-lg text-lg font-semibold text-white transition-all transform hover:scale-105 focus:outline-none bg-black hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 ${isLoading || disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            type="submit"
            disabled={isLoading || disabled}
          >
            {buttonContent}
          </button>
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

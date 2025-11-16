import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { MAIN_CATEGORIES, SUB_CATEGORIES, Transaction, CATEGORIES_WITH_TYPES, getCategoryType } from "@/types/database";
import { createClient } from "@/utils/supabase/client";
import { formatDateTimeLocal, parseDateTime } from "@/utils/date";
import { parseNumber } from "@/utils/number";
import {
  ArrowLeft,
  Calendar,
  MinusCircle,
  PlusCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { useFormFieldProtection } from "@/hooks/useFormFieldProtection";
import styles from "./transaction-form-html-design.module.css";

type TransactionFormProps = Readonly<{
  onSubmit: (
    data: Omit<Transaction, "id" | "created_at" | "updated_at">
  ) => Promise<void>;
  initialData?: Transaction;
  onBack?: () => void;
}>;

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD", symbol: "$" },
  { value: "EUR", label: "EUR", symbol: "€" },
  { value: "JPY", label: "JPY", symbol: "¥" },
];

export default function TransactionFormHtmlDesign({
  onSubmit,
  initialData,
  onBack,
}: TransactionFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [mainCategory, setMainCategory] = useState(
    initialData?.main_category || MAIN_CATEGORIES[0]
  );
  const [transactionType, setTransactionType] = useState<"expense" | "income">(
    initialData?.type || "expense"
  );

  // Reset main category when transaction type changes if current category is not valid for the new type
  useEffect(() => {
    if (mainCategory && getCategoryType(mainCategory) !== transactionType) {
      setMainCategory(MAIN_CATEGORIES[0]);
    }
  }, [transactionType, mainCategory]);

  const [selectedCurrency, setSelectedCurrency] = useState(
    initialData?.currency || "EUR"
  );
  const [hideFromTotals, setHideFromTotals] = useState(
    initialData?.hide_from_totals || false
  );
  const hideFromTotalsRef = useRef(initialData?.hide_from_totals || false);

  // Protect amount field from browser extension errors
  useFormFieldProtection('amount');

  // Additional aggressive protection for 1Password
  useEffect(() => {
    const amountField = document.getElementById('amount') as HTMLInputElement;
    if (!amountField) return;

    // Add a more aggressive protection by wrapping the field in a proxy
    const originalFocus = amountField.focus;
    amountField.focus = function(options?: FocusOptions) {
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
  
  const updateHideFromTotals = useCallback((value: boolean) => {
    setHideFromTotals(value);
    hideFromTotalsRef.current = value;
  }, []);

  const subCategories = useMemo(() => {
    return SUB_CATEGORIES[mainCategory as keyof typeof SUB_CATEGORIES] || [];
  }, [mainCategory]);

  const filteredMainCategories = useMemo(() => {
    return CATEGORIES_WITH_TYPES
      .filter(cat => cat.type === transactionType)
      .map(cat => cat.category);
  }, [transactionType]);

  const defaultDate = useMemo(() => {
    const date = initialData?.date || new Date().toISOString();
    return formatDateTimeLocal(date);
  }, [initialData?.date]);

  const currencySymbol = useMemo(() => {
    return CURRENCY_OPTIONS.find((c) => c.value === selectedCurrency)?.symbol || "€";
  }, [selectedCurrency]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setIsLoading(true);

      try {
        const formData = new FormData(e.currentTarget);
        const supabase = createClient();

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user?.id) throw new Error("User not authenticated");

        const data = {
          user_id: user.id,
          amount: parseNumber(formData.get("amount") as string),
          currency: selectedCurrency,
          type: transactionType,
          main_category: formData.get("main_category") as string,
          sub_category: formData.get("sub_category") as string,
          title: formData.get("title") as string,
          date: parseDateTime(formData.get("date") as string),
          hide_from_totals: hideFromTotalsRef.current,
        };


        await onSubmit(data);
      } catch (error) {
        console.error("Form submission failed:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [onSubmit, transactionType, selectedCurrency]
  );

  const handleCategoryChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setMainCategory(e.target.value);
    },
    []
  );

  const handleCurrencyChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedCurrency(e.target.value);
    },
    []
  );

  // Helper to get submit button color class
  const getSubmitButtonColorClass = (): string => {
    if (transactionType === "expense") {
      return "bg-red-600 hover:bg-red-700 focus:ring-red-500";
    }
    return "bg-green-600 hover:bg-green-700 focus:ring-green-500";
  };

  // Compute submit button content
  const buttonContent = initialData ? "Save" : "Add";

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-6 md:p-8 lg:p-12">
      {/* Header */}
      {onBack && (
        <div className="flex items-center mb-10">
          <button
            onClick={onBack}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            type="button"
          >
            <ArrowLeft size={20} />
            <span className="ml-2 text-lg font-medium">Back</span>
          </button>
        </div>
      )}

      <h1 className="text-4xl font-bold text-gray-800 mb-12">
        {initialData ? "Edit Entry" : "Add Entry"}
      </h1>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
          {/* Amount with Currency and Hide Toggle */}
          <div>
            <label
              className="block text-sm font-medium text-gray-700 mb-2"
              htmlFor="amount"
            >
              Amount
            </label>
            <div className="flex gap-3">
              <div className="flex-1" style={{ width: '75%' }}>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                    {currencySymbol}
                  </span>
                  <input
                    className="pl-10 pr-20 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm h-12"
                    id="amount"
                    name="amount"
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*[.,]?[0-9]*"
                    required
                    defaultValue={initialData?.amount}
                    autoComplete="transaction-amount"
                    data-lpignore="true"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center">
                    <select
                      className="h-full py-0 pl-2 pr-7 border-transparent bg-transparent text-gray-500 focus:border-indigo-500 focus:ring-indigo-500 text-sm rounded-md form-select"
                      id="currency"
                      name="currency"
                      value={selectedCurrency}
                      onChange={handleCurrencyChange}
                      aria-label="Currency selection"
                    >
                      {CURRENCY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              
              {/* Hide Toggle Eye Icon */}
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => updateHideFromTotals(!hideFromTotals)}
                  className={`h-12 px-3 flex items-center justify-center rounded-lg border transition-colors ${
                    hideFromTotals
                      ? 'bg-gray-100 border-gray-300 text-gray-600'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
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
          </div>

          {/* Title */}
          <div className="md:col-span-2">
            <label
              className="block text-sm font-medium text-gray-700 mb-2"
              htmlFor="title"
            >
              Title
            </label>
            <input
              className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm h-12 px-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              id="title"
              name="title"
              placeholder="e.g., Monthly groceries at the supermarket"
              type="text"
              required
              defaultValue={initialData?.title}
              autoComplete="off"
            />
          </div>

          {/* Transaction Type */}
          <div>
            <div className="block text-sm font-medium text-gray-700 mb-2">
              Type
            </div>
            <div className="flex space-x-4">
              <button
                className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center font-medium border-2 transition-all ${
                  transactionType === "expense"
                    ? "bg-red-100 text-red-700 border-red-500"
                    : "bg-red-50 text-red-700 border-gray-200 hover:bg-red-100 hover:border-red-400"
                }`}
                type="button"
                onClick={() => setTransactionType("expense")}
              >
                <MinusCircle size={20} className="mr-2" />
                Expense
              </button>
              <button
                className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center font-medium border-2 transition-all ${
                  transactionType === "income"
                    ? "bg-green-100 text-green-700 border-green-500"
                    : "bg-green-50 text-green-700 border-gray-200 hover:bg-green-100 hover:border-green-400"
                }`}
                type="button"
                onClick={() => setTransactionType("income")}
              >
                <PlusCircle size={20} className="mr-2" />
                Income
              </button>
            </div>
          </div>

          {/* Main Category */}
          <div>
            <label
              className="block text-sm font-medium text-gray-700 mb-2"
              htmlFor="main-category"
            >
              Main Category
            </label>
            <select
              className={`${styles.formSelect} block w-full pl-3 pr-10 py-3 border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm rounded-lg shadow-sm`}
              id="main-category"
              name="main_category"
              value={mainCategory}
              onChange={handleCategoryChange}
            >
              {filteredMainCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {/* Sub Category */}
          <div>
            <label
              className="block text-sm font-medium text-gray-700 mb-2"
              htmlFor="sub-category"
            >
              Sub Category
            </label>
            <select
              className={`${styles.formSelect} block w-full pl-3 pr-10 py-3 border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm rounded-lg shadow-sm`}
              id="sub-category"
              name="sub_category"
              defaultValue={initialData?.sub_category}
              key={mainCategory}
            >
              <option value="">Select sub category</option>
              {subCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label
              className="block text-sm font-medium text-gray-700 mb-2"
              htmlFor="date"
            >
              Date
            </label>
            <div className="relative">
              <input
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm h-12 pl-4 pr-10"
                id="date"
                name="date"
                type="datetime-local"
                required
                defaultValue={defaultDate}
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <Calendar size={20} className="text-gray-400" />
              </div>
            </div>
          </div>

        </div>

        {/* Submit Button */}
        <div className="mt-12">
          <button
            className={`w-full flex justify-center py-4 px-4 border border-transparent rounded-lg shadow-lg text-lg font-semibold text-white transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 ${getSubmitButtonColorClass()} ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
            type="submit"
            disabled={isLoading}
          >
            {buttonContent}
          </button>
        </div>
      </form>
    </div>
  );
}

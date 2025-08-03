import { useState, useCallback, useMemo } from "react";
import { MAIN_CATEGORIES, SUB_CATEGORIES, Transaction } from "@/types/database";
import { createClient } from "@/utils/supabase/client";
import { formatDateTimeLocal, parseDateTime } from "@/utils/date";
import { MinusCircle, PlusCircle } from "lucide-react";

interface TransactionFormModalProps {
  onSubmit: (data: Omit<Transaction, "id" | "created_at" | "updated_at">) => Promise<void>;
  initialData?: Transaction;
}

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD", symbol: "$" },
  { value: "EUR", label: "EUR", symbol: "€" },
  { value: "JPY", label: "JPY", symbol: "¥" },
] as const;

export default function TransactionFormModal({ onSubmit, initialData }: TransactionFormModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [mainCategory, setMainCategory] = useState(initialData?.main_category || MAIN_CATEGORIES[0]);
  const [transactionType, setTransactionType] = useState<"expense" | "income">(initialData?.type || "expense");
  const [selectedCurrency, setSelectedCurrency] = useState(initialData?.currency || "EUR");

  const { subCategories, defaultDate, currencySymbol } = useMemo(() => ({
    subCategories: SUB_CATEGORIES[mainCategory as keyof typeof SUB_CATEGORIES] || [],
    defaultDate: initialData?.date 
      ? formatDateTimeLocal(initialData.date) 
      : formatDateTimeLocal(new Date().toISOString()),
    currencySymbol: CURRENCY_OPTIONS.find(c => c.value === selectedCurrency)?.symbol || "€"
  }), [mainCategory, initialData?.date, selectedCurrency]);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user?.id) throw new Error("User not authenticated");

      await onSubmit({
        user_id: user.id,
        amount: Number(formData.get("amount")),
        currency: selectedCurrency,
        type: transactionType,
        main_category: formData.get("main_category") as string,
        sub_category: formData.get("sub_category") as string,
        title: formData.get("title") as string,
        date: parseDateTime(formData.get("date") as string),
      });
    } catch (error) {
      console.error("Form submission failed:", error);
    } finally {
      setIsLoading(false);
    }
  }, [onSubmit, transactionType, selectedCurrency]);

  const handleCategoryChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setMainCategory(e.target.value);
  }, []);

  const handleCurrencyChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCurrency(e.target.value);
  }, []);

  // Reusable class strings
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2";
  const inputClass = "block w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-sm h-12 px-4";
  const selectClass = "form-select block w-full pl-3 pr-10 py-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 text-sm rounded-lg shadow-sm";
  
  const getTypeButtonClass = (type: 'expense' | 'income', isSelected: boolean) => {
    const baseClass = "flex-1 py-3 px-4 rounded-lg flex items-center justify-center font-medium border-2 transition-all";
    const colorClass = type === 'expense' 
      ? isSelected 
        ? "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-500 dark:border-red-400"
        : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-gray-200 dark:border-gray-600 hover:bg-red-100 dark:hover:bg-red-900/40 hover:border-red-400 dark:hover:border-red-400"
      : isSelected
        ? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-500 dark:border-green-400"
        : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-gray-200 dark:border-gray-600 hover:bg-green-100 dark:hover:bg-green-900/40 hover:border-green-400 dark:hover:border-green-400";
    return `${baseClass} ${colorClass}`;
  };

  return (
    <div className="w-full bg-white dark:bg-gray-900 px-4 pt-2 pb-4 sm:px-6 sm:pt-3 sm:pb-6 md:px-8 md:pt-4 md:pb-8 lg:px-12 lg:pt-6 lg:pb-12 font-inter">

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          {/* Amount with Currency */}
          <div>
            <label className={labelClass} htmlFor="amount">Amount</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 dark:text-gray-400">
                {currencySymbol}
              </span>
              <input
                className={inputClass.replace('px-4', 'pl-10 pr-20')}
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                required
                defaultValue={initialData?.amount}
                autoComplete="off"
              />
              <div className="absolute inset-y-0 right-0 flex items-center">
                <select
                  className="h-full py-0 pl-2 pr-7 border-transparent bg-transparent text-gray-500 dark:text-gray-400 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-sm rounded-md form-select"
                  id="currency"
                  name="currency"
                  value={selectedCurrency}
                  onChange={handleCurrencyChange}
                  aria-label="Currency selection"
                >
                  {CURRENCY_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Transaction Type */}
          <div>
            <div className={labelClass}>Type</div>
            <div className="flex space-x-4">
              <button
                className={getTypeButtonClass('expense', transactionType === 'expense')}
                type="button"
                onClick={() => setTransactionType("expense")}
              >
                <MinusCircle size={20} className="mr-2" />
                Expense
              </button>
              <button
                className={getTypeButtonClass('income', transactionType === 'income')}
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
            <label className={labelClass} htmlFor="main-category">Main Category</label>
            <select
              className={selectClass}
              id="main-category"
              name="main_category"
              value={mainCategory}
              onChange={handleCategoryChange}
            >
              {MAIN_CATEGORIES.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {/* Sub Category */}
          <div>
            <label className={labelClass} htmlFor="sub-category">Sub Category</label>
            <select
              className={selectClass}
              id="sub-category"
              name="sub_category"
              defaultValue={initialData?.sub_category}
              key={mainCategory}
            >
              <option value="">Select sub category</option>
              {subCategories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div className="md:col-span-2">
            <label className={labelClass} htmlFor="title">Title</label>
            <input
              className={inputClass}
              id="title"
              name="title"
              placeholder="e.g., Monthly groceries at the supermarket"
              type="text"
              required
              defaultValue={initialData?.title}
              autoComplete="off"
            />
          </div>

          {/* Date */}
          <div>
            <label className={labelClass} htmlFor="date">Date</label>
            <input
              className={inputClass}
              id="date"
              name="date"
              type="datetime-local"
              required
              defaultValue={defaultDate}
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="mt-6 sm:mt-8 md:mt-12 pb-4">
          <button
            className={`w-full flex justify-center py-4 px-4 border border-transparent rounded-lg shadow-lg text-lg font-semibold text-white transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
              transactionType === "expense"
                ? "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 focus:ring-red-500 dark:focus:ring-red-400"
                : "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 focus:ring-green-500 dark:focus:ring-green-400"
            } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                {initialData ? "Saving Changes..." : "Adding Transaction..."}
              </div>
            ) : initialData ? (
              "Save Changes"
            ) : (
              `Add ${transactionType === "expense" ? "Expense" : "Income"}`
            )}
          </button>
        </div>
      </form>

      <style jsx>{`
        .form-select {
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
          background-repeat: no-repeat;
          background-position: right 0.5rem center;
          background-size: 1.5em 1.5em;
          -webkit-appearance: none;
          -moz-appearance: none;
          appearance: none;
        }
        
        :global(.dark) .form-select {
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
        }
      `}</style>
    </div>
  );
}

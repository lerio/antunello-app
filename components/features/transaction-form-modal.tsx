import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  SUB_CATEGORIES,
  Transaction,
  CATEGORIES_WITH_TYPES,
  getCategoryType,
  TitleSuggestion,
} from "@/types/database";
import { createClient } from "@/utils/supabase/client";
import { parseNumber } from "@/utils/number";
import { generateTransferTitle } from "@/utils/money-transfer-validation";
import {
  MinusCircle,
  PlusCircle,
  Trash2,
  ChevronDown,
  ArrowRightLeft,
} from "lucide-react";
import { DateTimePicker } from "@/components/ui/date-picker";
import { ValidationTooltip } from "@/components/ui/validation-tooltip";
import { CategorySelect } from "@/components/ui/category-select";
import { TitleSuggestionInput } from "@/components/ui/title-suggestion-input";
import { FundSelect } from "@/components/ui/fund-select";
import { Switch } from "@/components/ui/switch";
import { useFundCategories } from "@/hooks/useFundCategories";
import { useFormFieldProtection } from "@/hooks/useFormFieldProtection";
import { getTypeButtonClass } from "@/utils/styling-utils";
import {
  validateTransactionFields,
  validateMoneyTransferFields,
  hasValidationErrors,
  emptyValidationErrors,
  type ValidationErrors,
} from "@/utils/form-validation";
import { CURRENCY_OPTIONS } from "@/constants/app-constants";

function renderSubmitButtonContent(
  isLoading: boolean,
  hasInitialData: boolean
): React.ReactNode {
  return hasInitialData ? "Save" : "Add";
}

// Subcomponent: Type selector toggle (3 buttons: expense, income, transfer)
function TypeSelector({
  transactionType,
  setTransactionType,
  isMoneyTransferMode,
  setIsMoneyTransferMode,
  disabled,
}: {
  readonly transactionType: "expense" | "income";
  readonly setTransactionType: React.Dispatch<
    React.SetStateAction<"expense" | "income">
  >;
  readonly isMoneyTransferMode: boolean;
  readonly setIsMoneyTransferMode: (value: boolean) => void;
  readonly disabled: boolean;
}) {
  return (
    <div>
      <div className="flex space-x-3">
        <button
          className={getTypeButtonClass(
            "expense",
            !isMoneyTransferMode && transactionType === "expense",
            disabled
          )}
          type="button"
          onClick={() => {
            if (!disabled) {
              setIsMoneyTransferMode(false);
              setTransactionType("expense");
            }
          }}
          disabled={disabled}
          title="Expense"
        >
          <MinusCircle size={20} />
        </button>
        <button
          className={getTypeButtonClass(
            "income",
            !isMoneyTransferMode && transactionType === "income",
            disabled
          )}
          type="button"
          onClick={() => {
            if (!disabled) {
              setIsMoneyTransferMode(false);
              setTransactionType("income");
            }
          }}
          disabled={disabled}
          title="Income"
        >
          <PlusCircle size={20} />
        </button>
        <button
          className={getTypeButtonClass("transfer", isMoneyTransferMode, disabled)}
          type="button"
          onClick={() => !disabled && setIsMoneyTransferMode(true)}
          disabled={disabled}
          title="Money Transfer"
        >
          <ArrowRightLeft size={20} />
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
        type="button"
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
  const [selectedCurrency, setSelectedCurrency] = useState(
    initialData?.currency || "EUR"
  );
  const [selectedDate, setSelectedDate] = useState<Date>(
    initialData?.date ? new Date(initialData.date) : new Date()
  );
  const [selectedFundCategoryId, setSelectedFundCategoryId] = useState<
    string | null
  >(initialData?.fund_category_id || null);

  // Money transfer state
  const [isMoneyTransferMode, setIsMoneyTransferMode] = useState(
    initialData?.is_money_transfer || false
  );
  const [targetFundCategoryId, setTargetFundCategoryId] = useState<
    string | null
  >(initialData?.target_fund_category_id || null);

  // Reset main category when transaction type changes if current category is not valid for the new type
  useEffect(() => {
    if (mainCategory && getCategoryType(mainCategory) !== transactionType) {
      setMainCategory("");
      setSubCategory("");
    }
  }, [transactionType, mainCategory]);

  // Auto-set defaults when entering/exiting money transfer mode
  useEffect(() => {
    if (isMoneyTransferMode) {
      setTransactionType("expense");
      setMainCategory("Money Transfer");
      setSubCategory("Money Transfer");
    } else {
      // Reset categories when exiting money transfer mode
      if (mainCategory === "Money Transfer") {
        setMainCategory("");
        setSubCategory("");
      }
    }
  }, [isMoneyTransferMode, mainCategory]);

  // Auto-generate title for money transfers
  useEffect(() => {
    if (isMoneyTransferMode && selectedFundCategoryId && targetFundCategoryId) {
      const sourceFund = fundCategories.find(
        (f) => f.id === selectedFundCategoryId
      );
      const targetFund = fundCategories.find(
        (f) => f.id === targetFundCategoryId
      );
      if (sourceFund && targetFund) {
        setTitle(generateTransferTitle(sourceFund.name, targetFund.name));
      }
    }
  }, [
    isMoneyTransferMode,
    selectedFundCategoryId,
    targetFundCategoryId,
    fundCategories,
  ]);

  // Title suggestion state
  const [title, setTitle] = useState(initialData?.title || "");
  const [autoFilledFields, setAutoFilledFields] = useState<{
    type: boolean;
    mainCategory: boolean;
    subCategory: boolean;
  }>({
    type: false,
    mainCategory: false,
    subCategory: false,
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
      subCategory: !!suggestion.sub_category,
    });
  }, []);

  // Reset auto-fill indicators when user manually changes fields
  const handleTypeChange = useCallback(
    (type: React.SetStateAction<"expense" | "income">) => {
      setTransactionType(type);
      setAutoFilledFields((prev) => ({ ...prev, type: false }));
    },
    []
  );

  const handleCategoryChange = useCallback((value: string) => {
    setMainCategory(value);
    setSubCategory(""); // Reset sub category when main category changes
    setAutoFilledFields((prev) => ({
      ...prev,
      mainCategory: false,
      subCategory: false,
    }));
  }, []);

  const handleSubCategoryChange = useCallback((value: string) => {
    setSubCategory(value);
    setAutoFilledFields((prev) => ({ ...prev, subCategory: false }));
  }, []);

  // Protect amount field from browser extension errors
  useFormFieldProtection("amount");

  // Additional aggressive protection for 1Password
  useEffect(() => {
    const amountField = document.getElementById("amount") as HTMLInputElement;
    if (!amountField) return;

    // Add a more aggressive protection by wrapping the field in a proxy
    const originalFocus = amountField.focus;
    amountField.focus = function (options?: FocusOptions) {
      // Add defensive properties before calling focus
      try {
        Object.defineProperty(this, "control", {
          value: this,
          writable: false,
          configurable: true,
        });
        Object.defineProperty(this, "form", {
          value: this.closest("form"),
          writable: false,
          configurable: true,
        });
        Object.defineProperty(this, "ownerDocument", {
          value: document,
          writable: false,
          configurable: true,
        });
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
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(
    emptyValidationErrors
  );

  const { currencySymbol, mainCategoryOptions, subCategoryOptions } = useMemo(
    () => ({
      subCategories:
        SUB_CATEGORIES[mainCategory as keyof typeof SUB_CATEGORIES] || [],
      currencySymbol:
        CURRENCY_OPTIONS.find((c) => c.value === selectedCurrency)?.symbol ||
        "€",
      mainCategoryOptions: CATEGORIES_WITH_TYPES.filter(
        (cat) =>
          cat.type === transactionType && cat.category !== "Money Transfer"
      ).map((category) => ({
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

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      // Clear previous validation errors
      setValidationErrors(emptyValidationErrors);

      // Validate all required fields
      const formData = new FormData(e.currentTarget);
      const amount = formData.get("amount") as string;
      const formTitle = formData.get("title") as string;
      const formMainCategory = formData.get("main_category") as string;
      const formSubCategory = formData.get("sub_category") as string;

      // Conditional validation based on mode
      const newErrors = isMoneyTransferMode
        ? validateMoneyTransferFields(amount, selectedFundCategoryId, targetFundCategoryId)
        : validateTransactionFields(amount, formMainCategory, formSubCategory, formTitle);

      if (hasValidationErrors(newErrors)) {
        setValidationErrors(newErrors);
        // Auto-dismiss tooltips after 4 seconds
        setTimeout(() => {
          setValidationErrors(emptyValidationErrors);
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
          type: isMoneyTransferMode ? ("expense" as const) : transactionType,
          main_category: isMoneyTransferMode ? "Money Transfer" : mainCategory,
          sub_category: isMoneyTransferMode ? "Money Transfer" : subCategory,
          title: isMoneyTransferMode
            ? title
            : (formData.get("title") as string),
          date: selectedDate.toISOString(),
          hide_from_totals: hideFromTotalsRef.current,
          fund_category_id: selectedFundCategoryId,
          is_money_transfer: isMoneyTransferMode,
          target_fund_category_id: isMoneyTransferMode
            ? targetFundCategoryId
            : null,
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
      isMoneyTransferMode,
      targetFundCategoryId,
      title,
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

  const buttonContent = renderSubmitButtonContent(isLoading, !!initialData);

  return (
    <div
      className={`w-full bg-white dark:bg-gray-900 px-4 pt-2 pb-2 sm:px-6 sm:pt-3 sm:pb-6 md:px-8 md:pt-4 md:pb-8 lg:px-12 lg:pt-6 lg:pb-12 font-inter`}
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
          {/* Amount with Currency and Hide Toggle */}
          <div className="md:col-span-2">
            <div className="flex gap-3">
              <div className="flex-1" style={{ width: "60%" }}>
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
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                      <div className="relative">
                        <select
                          className={`h-full py-0 pl-2 pr-6 border-transparent bg-transparent text-gray-500 dark:text-gray-400 focus:outline-none text-base rounded-md appearance-none cursor-pointer ${disabled ? "opacity-50 cursor-not-allowed" : ""
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
                        <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </ValidationTooltip>
              </div>

              {/* Hide Toggle with Switch and Label */}
              <div className="flex items-end">
                <div className="flex items-center gap-2 h-12">
                  <label htmlFor="hide-from-totals" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Hide
                  </label>
                  <Switch
                    id="hide-from-totals"
                    name="hide_from_totals"
                    checked={hideFromTotals}
                    onCheckedChange={(checked) =>
                      !isMoneyTransferMode && updateHideFromTotals(checked)
                    }
                    disabled={disabled || isMoneyTransferMode}
                    title={
                      isMoneyTransferMode
                        ? "Money transfers are automatically excluded from totals"
                        : hideFromTotals
                          ? "Hidden from monthly totals"
                          : "Visible in monthly totals"
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Transaction Type Selector (Expense / Income / Transfer) */}
          <div className="md:col-span-2">
            <TypeSelector
              transactionType={transactionType}
              setTransactionType={handleTypeChange}
              isMoneyTransferMode={isMoneyTransferMode}
              setIsMoneyTransferMode={setIsMoneyTransferMode}
              disabled={disabled}
            />
          </div>

          {/* Source (Fund Category) - Only show for regular transactions */}
          {!isMoneyTransferMode && (
            <div className="md:col-span-2">
              <FundSelect
                options={fundCategories.filter((fund) => fund.is_active)}
                value={selectedFundCategoryId}
                onChange={setSelectedFundCategoryId}
                placeholder="Select fund"
                disabled={disabled || fundCategoriesLoading}
              />
              <input
                type="hidden"
                name="fund_category_id"
                value={selectedFundCategoryId || ""}
              />
            </div>
          )}

          {/* Conditional Fields Based on Mode */}
          {!isMoneyTransferMode ? (
            <>
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

              {/* Main Category */}
              <div className="relative">
                <ValidationTooltip
                  message={validationErrors.mainCategory}
                  isVisible={!!validationErrors.mainCategory}
                  onClose={() =>
                    setValidationErrors((prev) => ({
                      ...prev,
                      mainCategory: "",
                    }))
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
                    setValidationErrors((prev) => ({
                      ...prev,
                      subCategory: "",
                    }))
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
                    <input
                      type="hidden"
                      name="sub_category"
                      value={subCategory}
                    />
                  </div>
                </ValidationTooltip>
                {autoFilledFields.subCategory && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-sm" />
                )}
              </div>
            </>
          ) : (
            <>
              {/* From Fund (Source) */}
              <div>
                <ValidationTooltip
                  message={validationErrors.mainCategory}
                  isVisible={!!validationErrors.mainCategory}
                  onClose={() =>
                    setValidationErrors((prev) => ({
                      ...prev,
                      mainCategory: "",
                    }))
                  }
                >
                  <FundSelect
                    options={fundCategories.filter((fund) => fund.is_active)}
                    value={selectedFundCategoryId}
                    onChange={setSelectedFundCategoryId}
                    placeholder="Select source fund"
                    disabled={disabled || fundCategoriesLoading}
                  />
                </ValidationTooltip>
                <input
                  type="hidden"
                  name="fund_category_id"
                  value={selectedFundCategoryId || ""}
                />
              </div>

              {/* To Fund (Target) */}
              <div>
                <ValidationTooltip
                  message={validationErrors.subCategory}
                  isVisible={!!validationErrors.subCategory}
                  onClose={() =>
                    setValidationErrors((prev) => ({
                      ...prev,
                      subCategory: "",
                    }))
                  }
                >
                  <FundSelect
                    options={fundCategories.filter((fund) => fund.is_active)}
                    value={targetFundCategoryId}
                    onChange={setTargetFundCategoryId}
                    placeholder="Select target fund"
                    disabled={disabled || fundCategoriesLoading}
                    error={
                      selectedFundCategoryId === targetFundCategoryId &&
                      selectedFundCategoryId !== null
                    }
                  />
                </ValidationTooltip>
                {/* Hidden inputs for form submission */}
                <input
                  type="hidden"
                  name="target_fund_category_id"
                  value={targetFundCategoryId || ""}
                />
                <input type="hidden" name="title" value={title} />
              </div>

              {/* Currency Warning (if different) */}
              {selectedFundCategoryId &&
                targetFundCategoryId &&
                (() => {
                  const sourceFund = fundCategories.find(
                    (f) => f.id === selectedFundCategoryId
                  );
                  const targetFund = fundCategories.find(
                    (f) => f.id === targetFundCategoryId
                  );
                  return (
                    sourceFund &&
                    targetFund &&
                    sourceFund.currency !== targetFund.currency && (
                      <div className="md:col-span-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                          <strong>Note:</strong> Amount is in{" "}
                          {targetFund.currency}. {sourceFund.currency} will be
                          converted using the exchange rate on the transaction
                          date.
                        </p>
                      </div>
                    )
                  );
                })()}
            </>
          )}

          {/* Date */}
          <div>
            <DateTimePicker
              date={selectedDate}
              onDateChange={(date) =>
                !disabled && setSelectedDate(date || new Date())
              }
              placeholder="Date"
              disabled={disabled}
              className="border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        {/* Submit and Cancel Buttons */}
        {!showDeleteConfirm && (
          <div className="mt-3 sm:mt-6 md:mt-8 pb-2">
            <div className="flex gap-3">
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
            </div>
          </div>
        )}
      </form>

      {/* Delete Confirmation Buttons - Outside form to prevent accidental submission */}
      {showDeleteConfirm && (
        <div className="mt-3 sm:mt-6 md:mt-8 pb-2 px-4 sm:px-6 md:px-8 lg:px-12">
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
          </div>
        </div>
      )}

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

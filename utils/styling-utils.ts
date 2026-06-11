/**
 * Styling utility functions and CSS class constants for the transaction form UI.
 *
 * Provides consistent, reusable Tailwind CSS class combinations for type toggles
 * (expense/income/transfer), input fields, select dropdowns, buttons, and
 * transaction summary displays. Handles dark mode, selected/unselected states,
 * disabled states, and conditional colouring based on financial data.
 *
 * @module utils/styling-utils
 */

import { cn } from "@/lib/utils";

// Type button styles for expense/income/transfer toggle
/**
 * Base and state-specific Tailwind CSS class configurations for transaction type
 * toggle buttons (expense, income, transfer).
 */
export const typeButtonStyles = {
  base: "flex-1 py-3 px-4 rounded-lg flex items-center justify-center font-medium border-2 transition-all",
  expense: {
    selected:
      "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-500 dark:border-red-400",
    unselected:
      "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-gray-200 dark:border-gray-600 hover:bg-red-100 dark:hover:bg-red-900/40 hover:border-red-400 dark:hover:border-red-400",
  },
  income: {
    selected:
      "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-500 dark:border-green-400",
    unselected:
      "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-gray-200 dark:border-gray-600 hover:bg-green-100 dark:hover:bg-green-900/40 hover:border-green-400 dark:hover:border-green-400",
  },
  transfer: {
    selected:
      "bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-900 dark:border-white",
    unselected:
      "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-800 hover:border-gray-900 dark:hover:border-white",
  },
} as const;

/**
 * Returns the combined Tailwind CSS class string for a transaction type toggle button.
 *
 * @param type - The transaction type ("expense", "income", or "transfer")
 * @param isSelected - Whether this type is currently selected
 * @param isDisabled - Whether the button should appear disabled (default: false)
 * @returns A combined CSS class string
 */
export function getTypeButtonClass(
  type: "expense" | "income" | "transfer",
  isSelected: boolean,
  isDisabled: boolean = false
): string {
  return cn(
    typeButtonStyles.base,
    typeButtonStyles[type][isSelected ? "selected" : "unselected"],
    isDisabled && "opacity-50 cursor-not-allowed"
  );
}

// Standard input styles
/**
 * Base and color Tailwind CSS class configurations for input fields.
 */
export const inputStyles = {
  base: "block w-full rounded-lg shadow-sm focus:outline-none text-base h-12 px-4",
  colors: "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100",
  disabled: "opacity-50 cursor-not-allowed",
} as const;

/**
 * Returns the combined Tailwind CSS class string for a form input field.
 *
 * @param isDisabled - Whether the input should appear disabled (default: false)
 * @returns A combined CSS class string
 */
export function getInputClass(isDisabled: boolean = false): string {
  return cn(inputStyles.base, inputStyles.colors, isDisabled && inputStyles.disabled);
}

// Standard select styles
/**
 * Base and color Tailwind CSS class configurations for select dropdowns.
 */
export const selectStyles = {
  base: "w-full px-3 py-2 border rounded-md text-sm focus:outline-none",
  colors: "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100",
  disabled: "opacity-50 cursor-not-allowed",
} as const;

/**
 * Returns the combined Tailwind CSS class string for a select dropdown.
 *
 * @param isDisabled - Whether the select should appear disabled (default: false)
 * @returns A combined CSS class string
 */
export function getSelectClass(isDisabled: boolean = false): string {
  return cn(selectStyles.base, selectStyles.colors, isDisabled && selectStyles.disabled);
}

// Submit button styles
/**
 * Variant-specific Tailwind CSS class configurations for action buttons.
 */
export const buttonStyles = {
  primary:
    "flex-1 flex justify-center py-4 px-4 border border-transparent rounded-lg shadow-lg text-lg font-semibold text-white transition-all transform hover:scale-105 focus:outline-none bg-black hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700",
  secondary:
    "flex-1 flex justify-center py-4 px-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg text-lg font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all transform hover:scale-105 focus:outline-none",
  destructive:
    "flex-1 flex justify-center items-center py-4 px-4 border border-transparent rounded-lg shadow-lg text-lg font-semibold text-white transition-all transform hover:scale-105 focus:outline-none bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800",
  disabled: "opacity-50 cursor-not-allowed",
} as const;

/**
 * Returns the combined Tailwind CSS class string for an action button.
 *
 * @param variant - The button variant ("primary", "secondary", or "destructive")
 * @param isDisabled - Whether the button should appear disabled (default: false)
 * @returns A combined CSS class string
 */
export function getButtonClass(
  variant: "primary" | "secondary" | "destructive",
  isDisabled: boolean = false
): string {
  return cn(buttonStyles[variant], isDisabled && buttonStyles.disabled);
}

/**
 * Returns the appropriate Tailwind text colour class for a difference value.
 * Intended for use in transaction summary displays where positive and negative
 * differences have distinct colours.
 *
 * @param difference - The difference value to evaluate
 * @param isIncome - Whether the context is an income row (default: false)
 * @returns A CSS class string for text colour
 */
export function getDifferenceColorClass(
  difference: number,
  isIncome: boolean = false
): string {
  const isPositive = difference > 0;
  if (isIncome) return isPositive ? "text-green-500" : "text-red-500";
  return isPositive ? "text-red-500" : "text-green-500";
}

/**
 * Returns the combined Tailwind CSS class string for a category name display,
 * applying appropriate indentation (sub-categories), colouring (hidden expenses),
 * and balance styling.
 *
 * @param isSubCategory - Whether this is a sub-category row
 * @param isHiddenExpense - Whether this is a hidden-from-totals expense
 * @param isBalance - Whether this is a balance row
 * @param isIncome - Whether this is an income category
 * @param total - Optional total value (used for balance colouring)
 * @returns A combined CSS class string
 */
export function getCategoryNameClass(
  isSubCategory: boolean,
  isHiddenExpense: boolean,
  isBalance: boolean,
  isIncome: boolean,
  total?: number
): string {
  const baseClass = "text-sm sm:text-sm";
  if (isSubCategory) return `${baseClass} ml-4`;
  if (isHiddenExpense)
    return `${baseClass} text-red-600 dark:text-red-400 ml-2 sm:ml-4`;
  if (isBalance) {
    const colorClass =
      (total || 0) >= 0
        ? "text-green-600 dark:text-green-400"
        : "text-red-600 dark:text-red-400";
    return `font-medium ${baseClass} ${colorClass}`;
  }
  if (isIncome)
    return `font-medium ${baseClass} text-green-600 dark:text-green-400`;
  return `font-medium ${baseClass} text-red-600 dark:text-red-400`;
}

/**
 * Returns the combined Tailwind CSS class string for a total amount display,
 * applying appropriate colouring based on category type and value.
 *
 * @param isSubCategory - Whether this is a sub-category row
 * @param itemType - The transaction type string ("income" or "expense")
 * @param isHiddenExpense - Whether this is a hidden-from-totals expense
 * @param isBalance - Whether this is a balance row
 * @param isIncome - Whether this is an income category
 * @param total - Optional total value (used for balance colouring)
 * @returns A combined CSS class string
 */
export function getTotalAmountClass(
  isSubCategory: boolean,
  itemType: string,
  isHiddenExpense: boolean,
  isBalance: boolean,
  isIncome: boolean,
  total?: number
): string {
  const baseClass = "text-sm sm:text-sm";
  if (isSubCategory)
    return `${baseClass} ${
      itemType === "income" ? "text-green-500" : "text-red-500"
    }`;
  if (isHiddenExpense) return `${baseClass} text-red-500`;
  if (isBalance)
    return `font-medium ${baseClass} ${
      (total || 0) >= 0 ? "text-green-500" : "text-red-500"
    }`;
  return `font-medium ${baseClass} ${
    isIncome ? "text-green-500" : "text-red-500"
  }`;
}

/**
 * Returns the combined Tailwind CSS class string for a monthly amount display,
 * with optional colouring for balance values.
 *
 * @param isBalance - Whether this is a balance row
 * @param monthlyAverage - Optional monthly average value (used for balance colouring)
 * @returns A combined CSS class string
 */
export function getMonthlyAmountClass(
  isBalance: boolean,
  monthlyAverage?: number
): string {
  const baseClass = "text-sm sm:text-sm";
  if (isBalance)
    return `${baseClass} ${
      (monthlyAverage || 0) >= 0 ? "text-green-500" : "text-red-500"
    }`;
  return baseClass;
}

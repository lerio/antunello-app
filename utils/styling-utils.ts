import { cn } from "@/lib/utils";

// Type button styles for expense/income/transfer toggle
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
export const inputStyles = {
  base: "block w-full rounded-lg shadow-sm focus:outline-none text-base h-12 px-4",
  colors: "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100",
  disabled: "opacity-50 cursor-not-allowed",
} as const;

export function getInputClass(isDisabled: boolean = false): string {
  return cn(inputStyles.base, inputStyles.colors, isDisabled && inputStyles.disabled);
}

// Submit button styles
export const buttonStyles = {
  primary:
    "flex-1 flex justify-center py-4 px-4 border border-transparent rounded-lg shadow-lg text-lg font-semibold text-white transition-all transform hover:scale-105 focus:outline-none bg-black hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700",
  secondary:
    "flex-1 flex justify-center py-4 px-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg text-lg font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all transform hover:scale-105 focus:outline-none",
  destructive:
    "flex-1 flex justify-center items-center py-4 px-4 border border-transparent rounded-lg shadow-lg text-lg font-semibold text-white transition-all transform hover:scale-105 focus:outline-none bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800",
  disabled: "opacity-50 cursor-not-allowed",
} as const;

export function getButtonClass(
  variant: "primary" | "secondary" | "destructive",
  isDisabled: boolean = false
): string {
  return cn(buttonStyles[variant], isDisabled && buttonStyles.disabled);
}

// Transaction summary styling utilities
export function getDifferenceColorClass(
  difference: number,
  isIncome: boolean = false
): string {
  const isPositive = difference > 0;
  if (isIncome) return isPositive ? "text-green-500" : "text-red-500";
  return isPositive ? "text-red-500" : "text-green-500";
}

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

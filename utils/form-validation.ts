import { isValidPositiveNumber } from "@/utils/number";

export interface ValidationErrors {
  amount: string;
  mainCategory: string;
  subCategory: string;
  title: string;
}

export const emptyValidationErrors: ValidationErrors = {
  amount: "",
  mainCategory: "",
  subCategory: "",
  title: "",
};

/**
 * Validate regular transaction form fields
 */
export function validateTransactionFields(
  amount: string,
  mainCategory: string,
  subCategory: string,
  title: string
): ValidationErrors {
  const errors = { ...emptyValidationErrors };

  if (!isValidPositiveNumber(amount)) {
    errors.amount = "Please enter a valid amount";
  }

  if (!mainCategory) {
    errors.mainCategory = "Please select a main category";
  }

  if (!subCategory?.trim()) {
    errors.subCategory = "Please select a sub category";
  }

  if (!title?.trim()) {
    errors.title = "Please enter a title";
  }

  return errors;
}

/**
 * Validate money transfer form fields
 */
export function validateMoneyTransferFields(
  amount: string,
  sourceFundId: string | null,
  targetFundId: string | null
): ValidationErrors {
  const errors = { ...emptyValidationErrors };

  if (!isValidPositiveNumber(amount)) {
    errors.amount = "Please enter a valid amount";
  }

  if (!sourceFundId) {
    errors.mainCategory = "Please select a source fund";
  }

  if (!targetFundId) {
    errors.subCategory = "Please select a target fund";
  }

  if (sourceFundId && targetFundId && sourceFundId === targetFundId) {
    errors.subCategory = "Source and target funds must be different";
  }

  return errors;
}

/**
 * Check if there are any validation errors
 */
export function hasValidationErrors(errors: ValidationErrors): boolean {
  return Object.values(errors).some((error) => error !== "");
}

/**
 * @file General-purpose utility functions used across the application.
 * Provides a Tailwind CSS class merging helper (`cn`) and a redirect
 * helper that encodes a status message into the query string
 * (`encodedRedirect`).
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { redirect } from "next/navigation";

/**
 * Merge Tailwind CSS class names with conflict resolution.
 * Combines `clsx` conditional class logic with `tailwind-merge` to
 * properly handle conflicting utilities.
 *
 * @param inputs - Class values to merge (strings, objects, arrays, etc.).
 * @returns A single merged class string.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Redirect to a path while encoding a status message in the query string.
 * The message is placed under the `type` query parameter (either `"error"`
 * or `"success"`).
 *
 * @param type  - The kind of feedback message (`"error"` or `"success"`).
 * @param path  - The destination path to redirect to.
 * @param message - The human-readable message to encode in the URL.
 * @throws {never} This function always throws a redirect (Next.js
 *         `redirect`).
 */
export function encodedRedirect(
  type: "error" | "success",
  path: string,
  message: string,
) {
  return redirect(`${path}?${type}=${encodeURIComponent(message)}`);
}

/**
 * @file Server actions for authentication (sign in, sign out, password reset).
 * Each action is a `"use server"` function that interacts with the Supabase
 * Auth API and redirects the user accordingly.
 */

"use server";

import { encodedRedirect } from "@/lib/utils";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

/**
 * Sign in an existing user with email and password.
 *
 * @param formData - A `FormData` object containing `"email"` and `"password"`
 *                   fields.
 * @returns A redirect to `/protected` on success, or to `/sign-in` with an
 *          error query parameter on failure.
 */
export const signInAction = async (formData: FormData) => {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return encodedRedirect("error", "/sign-in", error.message);
  }

  return redirect("/protected");
};

/**
 * Reset the current user's password. Both `"password"` and
 * `"confirmPassword"` fields are validated for presence and equality before
 * the update is submitted to Supabase.
 *
 * @param formData - A `FormData` object containing `"password"` and
 *                   `"confirmPassword"` fields.
 * @returns A redirect to `/protected/reset-password` with a success or error
 *          query parameter.
 */
export const resetPasswordAction = async (formData: FormData) => {
  const supabase = await createClient();

  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    encodedRedirect(
      "error",
      "/protected/reset-password",
      "Password and confirm password are required",
    );
  }

  if (password !== confirmPassword) {
    encodedRedirect("error", "/reset-password", "Passwords do not match");
  }

  const { error } = await supabase.auth.updateUser({
    password: password,
  });

  if (error) {
    encodedRedirect(
      "error",
      "/protected/reset-password",
      "Password update failed",
    );
  }

  encodedRedirect("success", "/protected/reset-password", "Password updated");
};

/**
 * Sign out the currently authenticated user.
 *
 * @returns A redirect to `/sign-in` after the session has been destroyed.
 */
export const signOutAction = async () => {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // Clear cache on sign out (client-side will handle this)
  return redirect("/sign-in");
};

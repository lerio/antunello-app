/**
 * Reads the Supabase environment variables from `process.env` and provides
 * typed accessor functions with validation.
 *
 * Three variables are expected:
 * - `NEXT_PUBLIC_SUPABASE_URL` (required) — the project URL.
 * - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` (preferred) — the publishable
 *   anonymous key for the current branch/environment.
 * - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (fallback) — the legacy anonymous key.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Returns the Supabase project URL.
 *
 * @returns The Supabase URL string from `NEXT_PUBLIC_SUPABASE_URL`.
 * @throws {Error} If the environment variable is not defined.
 */
export const getSupabaseUrl = () => {
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not defined");
  }

  return supabaseUrl;
};

/**
 * Returns the Supabase publishable (anonymous) key.
 *
 * Checks `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` first, then
 * falls back to `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
 *
 * @returns The Supabase publishable key string.
 * @throws {Error} If neither environment variable is defined.
 */
export const getSupabasePublishableKey = () => {
  if (!supabasePublishableKey) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return supabasePublishableKey;
};

/**
 * Whether both required Supabase public environment variables are set.
 *
 * Useful for guarding UI elements or pages that depend on Supabase connectivity.
 */
export const hasSupabasePublicEnvVars = Boolean(
  supabaseUrl && supabasePublishableKey,
);

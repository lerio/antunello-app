import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

/**
 * Creates a Supabase client for use in the browser.
 *
 * This client handles authentication via cookies and should be used in
 * Client Components (code that runs in the browser).
 *
 * @returns A Supabase browser client configured with the project URL
 *          and publishable anonymous key.
 */
export const createClient = () =>
  createBrowserClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
  );

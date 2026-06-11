import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

/**
 * Creates a Supabase client for use in Server Components and Server Actions.
 *
 * The client reads and writes auth cookies via the `next/headers` API,
 * enabling server-side authentication without requiring a middleware round-trip.
 *
 * @returns A Supabase server client configured with the project URL,
 *          publishable key, and cookie handlers for the current request.
 */
export const createClient = async () => {
  const cookieStore = await cookies();

  return createServerClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  );
};

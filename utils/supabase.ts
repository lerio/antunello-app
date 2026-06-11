/**
 * Legacy Supabase client instance.
 *
 * Creates and exports a singleton Supabase client using the project URL and
 * publishable key. This is the legacy client using `createClient` from `@supabase/supabase-js`
 * directly. New code should use the utility functions in `utils/supabase/client.ts`
 * which integrate with the Next.js App Router and cookie-based session management.
 *
 * @module utils/supabase
 */

import { createClient } from '@supabase/supabase-js'
import { Transaction } from '@/types/database'
import { getSupabasePublishableKey, getSupabaseUrl } from '@/utils/supabase/env'

/**
 * Legacy Supabase client instance typed with the Transaction database schema.
 * Uses direct URL and key configuration rather than cookie-based session management.
 *
 * @deprecated Use `createClient` from `@/utils/supabase/client` for server/client-side auth.
 */
export const supabase = createClient<Transaction>(
  getSupabaseUrl(),
  getSupabasePublishableKey()
)

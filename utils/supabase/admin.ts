import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl } from './env';

/**
 * Creates a Supabase admin client using the service role key.
 *
 * This client bypasses Row Level Security (RLS) and has full read/write
 * access to the database. It should only be used in trusted server-side
 * contexts such as API routes or admin-only pages.
 *
 * @returns A Supabase client configured with the service role key.
 * @throws {Error} If `SUPABASE_SERVICE_ROLE_KEY` environment variable is not defined.
 */
export const createAdminClient = () => {
    const supabaseUrl = getSupabaseUrl();
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseServiceKey) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY is not defined');
    }

    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
};

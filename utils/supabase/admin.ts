import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl } from './env';

// Note: This client has admin privileges. Use with caution.
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

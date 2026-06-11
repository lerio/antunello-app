import { hasSupabasePublicEnvVars } from "./env";

// This check can be removed
// it is just for tutorial purposes

/**
 * Whether the required Supabase public environment variables are set.
 *
 * Re-exported from `env.ts` for convenience when checking environment
 * variable availability in components or layouts.
 */
export const hasEnvVars = hasSupabasePublicEnvVars;

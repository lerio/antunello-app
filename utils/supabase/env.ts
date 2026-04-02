const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const getSupabaseUrl = () => {
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not defined");
  }

  return supabaseUrl;
};

export const getSupabasePublishableKey = () => {
  if (!supabasePublishableKey) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return supabasePublishableKey;
};

export const hasSupabasePublicEnvVars = Boolean(
  supabaseUrl && supabasePublishableKey,
);

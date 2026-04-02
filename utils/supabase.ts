import { createClient } from '@supabase/supabase-js'
import { Transaction } from '@/types/database'
import { getSupabasePublishableKey, getSupabaseUrl } from '@/utils/supabase/env'

export const supabase = createClient<Transaction>(
  getSupabaseUrl(),
  getSupabasePublishableKey()
)

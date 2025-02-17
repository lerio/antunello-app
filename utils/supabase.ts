import { createClient } from '@supabase/supabase-js'
import { Transaction } from '@/types/database'

export const supabase = createClient<Transaction>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
) 
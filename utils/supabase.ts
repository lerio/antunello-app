import { createClient } from '@supabase/supabase-js'
import { Transaction } from '@/types/database'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !anon) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Transaction>(
  url,
  anon
)

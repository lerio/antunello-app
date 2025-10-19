#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Check a specific transaction that should have been updated
const { data, error } = await supabase
  .from('transactions')
  .select('id, title')
  .eq('id', '45551899-010d-480c-bbc3-21c008da028a')

if (error) {
  console.error('Error:', error.message)
  process.exit(1)
}

console.log('Transaction check:', data)

// Check how many transactions still contain "||"
const { data: pipeTransactions, error: pipeError } = await supabase
  .from('transactions')
  .select('id')
  .like('title', '%||%')

if (pipeError) {
  console.error('Pipe check error:', pipeError.message)
  process.exit(1)
}

console.log(`Transactions still containing "||": ${pipeTransactions?.length || 0}`)

#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')
const path = require('node:path')

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Check a specific transaction that should have been updated, then count titles with "||"
supabase
  .from('transactions')
  .select('id, title')
  .eq('id', '45551899-010d-480c-bbc3-21c008da028a')
  .then(({ data, error }) => {
    if (error) {
      throw new Error(error.message)
    }
    console.log('Transaction check:', data)
    return supabase
      .from('transactions')
      .select('id')
      .like('title', '%||%')
  })
  .then(({ data: pipeTransactions, error: pipeError }) => {
    if (pipeError) {
      throw new Error(pipeError.message)
    }
    console.log(`Transactions still containing "||": ${pipeTransactions?.length || 0}`)
  })
  .catch((e) => {
    console.error('Error:', e.message || e)
    process.exitCode = 1
  })

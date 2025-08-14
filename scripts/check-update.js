#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')
const path = require('path')

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkUpdates() {
  // Check a specific transaction that should have been updated
  const { data, error } = await supabase
    .from('transactions')
    .select('id, title')
    .eq('id', '45551899-010d-480c-bbc3-21c008da028a')

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('Transaction check:', data)
  
  // Check how many transactions still contain "||"
  const { data: pipeTransactions, error: pipeError } = await supabase
    .from('transactions')
    .select('id')
    .like('title', '%||%')
  
  if (pipeError) {
    console.error('Pipe check error:', pipeError)
    return
  }
  
  console.log(`Transactions still containing "||": ${pipeTransactions?.length || 0}`)
}

checkUpdates()
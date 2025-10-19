#!/usr/bin/env node

/**
 * Debug script to test database update operations
 */

const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')
const path = require('node:path')

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Top-level flow without async wrapper
console.log('🔍 Getting one transaction with || for testing...')

supabase
  .from('transactions')
  .select('id, title')
  .like('title', '%||%')
  .limit(1)
  .then(({ data: transactions, error: selectError }) => {
    if (selectError) throw new Error(selectError.message)
    if (!transactions || transactions.length === 0) {
      console.log('✅ No transactions with || found')
      return null
    }

    const transaction = transactions[0]
    console.log('📄 Original transaction:')
    console.log(`   ID: ${transaction.id}`)
    console.log(`   Title: "${transaction.title}"`)

    const newTitle = 'TEST UPDATE - ' + new Date().toISOString()
    console.log(`\n🔄 Attempting to update title to: "${newTitle}"`)

    return supabase
      .from('transactions')
      .update({ title: newTitle })
      .eq('id', transaction.id)
      .select()
      .then(({ data: updateData, error: updateError }) => ({ transaction, newTitle, updateData, updateError }))
  })
  .then(async (ctx) => {
    if (!ctx) return
    const { transaction, newTitle, updateData, updateError } = ctx

    console.log('\n📊 Update result:')
    console.log('   Data:', updateData)
    console.log('   Error:', updateError)

    console.log('\n🔍 Verifying update...')
    const { data: verifyData, error: verifyError } = await supabase
      .from('transactions')
      .select('id, title')
      .eq('id', transaction.id)

    if (verifyError) throw new Error(verifyError.message)

    console.log('📄 Updated transaction:')
    console.log(`   ID: ${verifyData[0].id}`)
    console.log(`   Title: "${verifyData[0].title}"`)

    if (verifyData[0].title === newTitle) {
      console.log('✅ Update successful!')
    } else {
      console.log('❌ Update failed - title unchanged')
    }

    console.log('\n🔐 Checking authentication...')
    const { data: userData, error: userError } = await supabase.auth.getUser()
    console.log('   User data:', userData)
    console.log('   User error:', userError)

    console.log('\n🛡️ Testing RLS policies...')
    const { data: policyTest, error: policyError } = await supabase
      .from('transactions')
      .select('id, title, user_id')
      .eq('id', transaction.id)

    console.log('   Policy test data:', policyTest)
    console.log('   Policy test error:', policyError)
  })
  .catch((error) => {
    console.error('❌ Unexpected error:', error.message || error)
    process.exitCode = 1
  })

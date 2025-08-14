#!/usr/bin/env node

/**
 * Debug script to test database update operations
 */

const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')
const path = require('path')

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function debugUpdate() {
  try {
    // First, get one transaction with ||
    console.log('🔍 Getting one transaction with || for testing...')
    const { data: transactions, error: selectError } = await supabase
      .from('transactions')
      .select('id, title')
      .like('title', '%||%')
      .limit(1)

    if (selectError) {
      console.error('❌ Select error:', selectError)
      return
    }

    if (!transactions || transactions.length === 0) {
      console.log('✅ No transactions with || found')
      return
    }

    const transaction = transactions[0]
    console.log('📄 Original transaction:')
    console.log(`   ID: ${transaction.id}`)
    console.log(`   Title: "${transaction.title}"`)

    // Test update with a simple new title
    const newTitle = 'TEST UPDATE - ' + new Date().toISOString()
    console.log(`\n🔄 Attempting to update title to: "${newTitle}"`)

    const { data: updateData, error: updateError } = await supabase
      .from('transactions')
      .update({ title: newTitle })
      .eq('id', transaction.id)
      .select()

    console.log('\n📊 Update result:')
    console.log('   Data:', updateData)
    console.log('   Error:', updateError)

    // Verify the update by reading the transaction again
    console.log('\n🔍 Verifying update...')
    const { data: verifyData, error: verifyError } = await supabase
      .from('transactions')
      .select('id, title')
      .eq('id', transaction.id)

    if (verifyError) {
      console.error('❌ Verify error:', verifyError)
      return
    }

    console.log('📄 Updated transaction:')
    console.log(`   ID: ${verifyData[0].id}`)
    console.log(`   Title: "${verifyData[0].title}"`)

    if (verifyData[0].title === newTitle) {
      console.log('✅ Update successful!')
    } else {
      console.log('❌ Update failed - title unchanged')
    }

    // Check if it's a permissions issue by trying to read user info
    console.log('\n🔐 Checking authentication...')
    const { data: userData, error: userError } = await supabase.auth.getUser()
    console.log('   User data:', userData)
    console.log('   User error:', userError)

    // Test with RLS policies
    console.log('\n🛡️ Testing RLS policies...')
    const { data: policyTest, error: policyError } = await supabase
      .from('transactions')
      .select('id, title, user_id')
      .eq('id', transaction.id)

    console.log('   Policy test data:', policyTest)
    console.log('   Policy test error:', policyError)

  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
  }
}

debugUpdate()
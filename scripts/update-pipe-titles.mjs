#!/usr/bin/env node

/**
 * NodeJS script to update transaction titles containing "||" characters
 * This script finds transactions with "||" and updates them with cleaned titles
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline'
import { extractNewTitle, cleanTitle } from './lib/pipe-title-utils.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') })

// Check for flags
const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('-d')
const isVerbose = process.argv.includes('--verbose') || process.argv.includes('-v')

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  console.error('❌ Error: Missing Supabase environment variables')
  console.error(
    'Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY are set in .env.local',
  )
  process.exit(1)
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabasePublishableKey)

async function authenticateUser() {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout
  })

  const question = (prompt) => new Promise((resolve) => {
    readline.question(prompt, resolve)
  })

  try {
    console.log('🔐 Authentication required to update database')
    const email = await question('Enter your email: ')
    const password = await question('Enter your password: ')
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim()
    })

    readline.close()

    if (error) {
      console.error('❌ Authentication failed:', error.message)
      process.exit(1)
    }

    console.log('✅ Authentication successful')
    return data.user
  } catch (error) {
    readline.close()
    console.error('❌ Authentication error:', error.message)
    process.exit(1)
  }
}

async function updateTransactionTitles() {
  try {
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      console.log('📝 Update Transaction Titles with Cleaned Names')
      console.log('')
      console.log('Usage:')
      console.log('  npm run update-pipe-titles                    # Show what would be updated (dry run)')
      console.log('  npm run update-pipe-titles -- --execute       # Actually update the database')
      console.log('  npm run update-pipe-titles -- --dry-run       # Explicit dry run mode')
      console.log('  npm run update-pipe-titles -- --verbose       # Show detailed information')
      console.log('  npm run update-pipe-titles -- --help          # Show this help')
      console.log('')
      console.log('Description:')
      console.log('  This script updates transaction titles that contain "||" characters')
      console.log('  with cleaned merchant names extracted from the transaction data.')
      console.log('')
      console.log('⚠️  Warning: This will modify your database! Use --dry-run first.')
      process.exit(0)
    }

    const isExecute = process.argv.includes('--execute')
    const mode = isExecute ? 'EXECUTE' : 'DRY RUN'
    
    // Authenticate user if executing updates
    if (isExecute) {
      await authenticateUser()
    }
    
    console.log(`🔍 Finding transactions with "||" in titles... (${mode} mode)\n`)

    // Query transactions where title contains "||"
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('id, title, date, amount, currency, main_category, sub_category')
      .like('title', '%||%')
      .order('date', { ascending: false })

    if (error) {
      console.error('❌ Error querying database:', error.message)
      process.exit(1)
    }

    if (!transactions || transactions.length === 0) {
      console.log('✅ No transactions found with "||" in the title')
      return
    }

    console.log(`📊 Found ${transactions.length} transaction(s) with "||" in title`)
    
    if (isExecute) {
      console.log('🚨 EXECUTE MODE: Database will be updated!\n')
    } else {
      console.log('⚠️  DRY RUN MODE: No changes will be made to the database')
      console.log('   Use --execute flag to actually update the database\n')
    }


    // Prepare updates from transactions
    function prepareUpdates(transactions, isExecute, isVerbose) {
      const updates = []
      let skippedCount = 0

      for (let index = 0; index < transactions.length; index++) {
        const transaction = transactions[index]
        const rawTitle = extractNewTitle(transaction.title)
        const newTitle = cleanTitle(rawTitle)

        if (newTitle === transaction.title || newTitle === 'N/A' || !newTitle) {
          skippedCount++
          continue
        }

        updates.push({
          id: transaction.id,
          oldTitle: transaction.title,
          newTitle: newTitle
        })

        if (isVerbose || (!isExecute && index < 10)) {
          console.log(`${index + 1}. ID: ${transaction.id}`)
          console.log(`   Old: "${transaction.title}"`)
          console.log(`   New: "${newTitle}"`)
          console.log('   ' + '-'.repeat(50))
        }
      }

      return { updates, skippedCount }
    }

    // Execute a single transaction update
    async function executeUpdate(update, supabase, isVerbose) {
      try {
        const { error } = await supabase
          .from('transactions')
          .update({ title: update.newTitle })
          .eq('id', update.id)

        if (error) {
          console.error(`❌ Failed to update ${update.id}: ${error.message}`)
          return false
        }

        if (isVerbose) {
          console.log(`✅ Updated ${update.id}`)
        }
        return true
      } catch (error) {
        console.error(`❌ Error updating ${update.id}: ${error.message}`)
        return false
      }
    }

    // Execute batch updates
    async function executeBatchUpdates(updates, supabase, isVerbose) {
      let successCount = 0
      let errorCount = 0
      const batchSize = 50

      console.log(`\n🚀 Starting database updates (batch processing)...`)

      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize)
        console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(updates.length/batchSize)} (${batch.length} items)...`)

        for (const update of batch) {
          const success = await executeUpdate(update, supabase, isVerbose)
          if (success) {
            successCount++
          } else {
            errorCount++
          }
        }

        if (i + batchSize < updates.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      return { successCount, errorCount }
    }

    // Process transactions and prepare updates
    const { updates, skippedCount } = prepareUpdates(transactions, isExecute, isVerbose)

    console.log(`\n📈 Summary:`)
    console.log(`   Total transactions found: ${transactions.length}`)
    console.log(`   Transactions to update: ${updates.length}`)
    console.log(`   Transactions skipped: ${skippedCount}`)

    if (updates.length === 0) {
      console.log('✅ No updates needed!')
      return
    }

    if (!isExecute) {
      console.log(`\n💡 To actually update the database, run:`)
      console.log(`   npm run update-pipe-titles -- --execute`)
      return
    }

    const { successCount, errorCount } = await executeBatchUpdates(updates, supabase, isVerbose)

    console.log(`\n📊 Update Results:`)
    console.log(`   Successfully updated: ${successCount}`)
    console.log(`   Failed updates: ${errorCount}`)

    if (successCount > 0) {
      console.log(`\n✅ Database update completed!`)
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
    process.exit(1)
  }
}

try {
  await updateTransactionTitles()
  console.log('\n✅ Script completed successfully')
  process.exit(0)
} catch (error) {
  console.error('❌ Script failed:', error.message)
  process.exit(1)
}

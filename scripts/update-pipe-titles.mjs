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

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') })

// Check for flags
const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('-d')
const isVerbose = process.argv.includes('--verbose') || process.argv.includes('-v')

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Error: Missing Supabase environment variables')
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local')
  process.exit(1)
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
    
    if (!isExecute) {
      console.log('⚠️  DRY RUN MODE: No changes will be made to the database')
      console.log('   Use --execute flag to actually update the database\n')
    } else {
      console.log('🚨 EXECUTE MODE: Database will be updated!\n')
    }

    // Extract PayPal transaction name from description
    function extractPayPalTitle(description) {
      const match = description.match(/(?:PP\.\d+\.PP\s*\.\s*|^\.\s*)([A-Z][A-Za-z0-9\s&.-]+?)(?:\s+Ihr\s+Einkauf|$)/)
      if (match && match[1]) {
        return match[1].trim()
      }

      const cleaned = description
        .replace(/^PP\.\d+\.PP\s*\.\s*/, '')
        .replace(/^\.\s*/, '')
        .replace(/\s+Ihr\s+Einkauf.*$/, '')
        .replace(/\s+AWV-MELDEPFLICHT.*$/, '')
        .trim()

      return cleaned || description
    }

    // Extract ADYEN transaction name from description
    function extractAdyenTitle(description) {
      const match = description.match(/^([A-Za-z0-9\s&.-]+?)(?:\s+\d+|\s+L\s|\s+AWV-MELDEPFLICHT|$)/)
      if (match && match[1]) {
        return match[1].trim()
      }

      const cleaned = description
        .replace(/\s+\d+.*$/, '')
        .replace(/\s+L\s.*$/, '')
        .replace(/\s+AWV-MELDEPFLICHT.*$/, '')
        .trim()

      return cleaned || description
    }

    // Extract new title from transaction with special provider handling
    function extractNewTitle(title) {
      const firstIndex = title.indexOf('||')
      if (firstIndex === -1) return 'N/A'

      const secondIndex = title.indexOf('||', firstIndex + 2)
      if (secondIndex === -1) {
        return title.substring(firstIndex + 2).trim()
      }

      const merchantName = title.substring(firstIndex + 2, secondIndex).trim()
      const textAfterSecondPipe = title.substring(secondIndex + 2).trim()

      if (merchantName.toLowerCase().includes('paypal')) {
        return extractPayPalTitle(textAfterSecondPipe)
      }

      if (merchantName.toLowerCase().includes('adyen')) {
        return extractAdyenTitle(textAfterSecondPipe)
      }

      return merchantName
    }

    // Clean the extracted title from common strings and patterns
    function cleanTitle(title) {
      return title
        // Remove location patterns like "//BERLIN/DE" or "//Berlin Wedding/DE"
        .replace(/\/\/[^/]+\/[A-Z]{2}(?:\/\d+)?\s*\/.*$/i, '')
        .replace(/\/\/[^/]+\/[A-Z]{2}$/i, '')
        
        // Remove common purchase/transaction phrases
        .replace(/\s+Your\s+purchase\s+at\s+(.+)$/i, '')
        .replace(/\s+purchase\s+at\s+.+$/i, '')
        
        // Remove common German phrases and store codes
        .replace(/\s+SAGT\s+DANKE?\.?\s*\d*$/i, '')
        .replace(/\s+BEDANKT\s+SICH$/i, '')
        .replace(/\s+SAGT\s+DANK$/i, '')
        
        // Remove store/branch codes and patterns
        .replace(/\s+H:\d+/g, '')
        .replace(/\s+FIL\.\d+/g, '')
        .replace(/\s+R\d{3,}/g, '')
        .replace(/\s+GIR\s+\d+/g, '')
        .replace(/\s+\d{8,}/g, '')
        
        // Remove alphanumeric transaction/reference codes
        .replace(/\s+[A-Z0-9]{15,}$/g, '')
        .replace(/\s+[A-Z0-9]{10,}[A-Z0-9]*$/g, '')
        
        // Remove payment method descriptions
        .replace(/\s+Lastschrift\s+aus\s+Kartenzahlung.*$/i, '')
        
        // Clean business name patterns
        .replace(/\s+U\s+CO\s+KG.*$/, ' & Co KG')
        .replace(/\s+FIL\s+\d+.*$/, '')
        
        // Specific merchant name improvements
        .replace(/^DM\s.*/, 'DM Drogeriemarkt')
        .replace(/^KARSTADT\s+LEBENSM\..*/, 'Karstadt')
        .replace(/^KARSTADT(?:\s+.*)?$/, 'Karstadt')
        .replace(/^REWE\s+.*/, 'REWE')
        .replace(/^SPOTIFY\s.*/, 'Spotify')
        .replace(/^UBER\s+BV.*/, 'Uber')
        .replace(/^APPLE\s+STORE.*/, 'Apple Store')
        
        // Clean up complex patterns that still have locations/descriptions
        .replace(/^([A-Z][A-Za-z\s&.-]+?)\/\/.*$/, '$1')
        .replace(/^([A-Z][A-Za-z\s&.-]+?)\s+\/\s+.*$/, '$1')
        
        // Normalize business suffixes
        .replace(/\s+GMBH$/i, ' GmbH')
        .replace(/\s+UG$/i, ' UG')
        .replace(/\s+SPA$/i, ' SpA')
        .replace(/\s+SRL$/i, ' SRL')
        
        // Clean up spaces
        .replace(/\s+/g, ' ')
        .trim()
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

#!/usr/bin/env node

/**
 * NodeJS script to update transaction titles containing "||" characters
 * This script finds transactions with "||" and updates them with cleaned titles
 */

const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')
const path = require('node:path')

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
  const readline = require('node:readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt) => new Promise((resolve) => {
    readline.question(prompt, resolve);
  });

  try {
    console.log('🔐 Authentication required to update database');
    const email = await question('Enter your email: ');
    const password = await question('Enter your password: ');
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim()
    });

    readline.close();

    if (error) {
      console.error('❌ Authentication failed:', error.message);
      process.exit(1);
    }

    console.log('✅ Authentication successful');
    return data.user;
  } catch (error) {
    readline.close();
    console.error('❌ Authentication error:', error.message);
    process.exit(1);
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
      await authenticateUser();
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

    // Extract PayPal transaction name from description
    function extractPayPalTitle(description) {
      // Clamp input to prevent ReDoS
      const clampedDesc = description.length > 512 ? description.slice(0, 512) : description;
      
      const match = clampedDesc.match(/(?:(?:PP\.\d{1,4}\.PP(?=(\s+))\1\.(?=(\s+))\2)|(?:^\.(?=(\s+))\3))([A-Z][A-Za-z0-9\s&.-]{1,100})(?:(?=(\s+))\4Ihr(?=(\s+))\5Einkauf|$)/)
      if (match && match[4]) {
        return match[4].trim()
      }

      const cleaned = clampedDesc
        .replace(/^PP\.\d{1,4}\.PP(?=(\s+))\1\.(?=(\s+))\2/, '')
        .replace(/^\.(?=(\s+))\1/, '')
        .replace(/(?=(\s+))\1Ihr(?=(\s+))\2Einkauf[^\s\n]{1,100}[^\n]{1,100}$/, '')
        .replace(/(?=(\s+))\1AWV-MELDEPFLICHT[^\s\n]{1,100}[^\n]{1,100}$/, '')
        .trim()

      return cleaned || clampedDesc
    }

    // Extract ADYEN transaction name from description
    function extractAdyenTitle(description) {
      // Clamp input to prevent ReDoS
      const clampedDesc = description.length > 512 ? description.slice(0, 512) : description;
      
      const match = clampedDesc.match(/^([A-Za-z0-9\s&.-]{1,100})(?:(?=(?=(\s+))\2(?:\d{1,10}|L(?=(\s+))\3|AWV-MELDEPFLICHT))|$)/)
      if (match && match[1]) {
        return match[1].trim()
      }

      const cleaned = clampedDesc
        .replace(/(?=(\s+))\1\d{1,10}(?:(?=(\s+))\2[^\n]{0,100})?$/, '')
        .replace(/(?=(\s+))\1L(?=(\s+))\2(?:(?=(\s+))\3[^\n]{0,100})?$/, '')
        .replace(/(?=(\s+))\1AWV-MELDEPFLICHT(?:(?=(\s+))\2[^\n]{0,100})?$/, '')
        .trim()

      return cleaned || clampedDesc
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
      // Clamp input to prevent ReDoS
      const clampedTitle = title.length > 512 ? title.slice(0, 512) : title;
      
      return clampedTitle
        // Remove location patterns like "//BERLIN/DE" or "//Berlin Wedding/DE"
        .replace(/\/\/[^/]{1,50}\/[A-Z]{2}(?:\/\d{1,10})?(?=(\s+))\1\/[^\n]{0,200}$/i, '')
        .replace(/\/\/[^/]{1,50}\/[A-Z]{2}$/i, '')
        
        // Remove common purchase/transaction phrases
        .replace(/(?=(\s+))\1Your(?=(\s+))\2purchase(?=(\s+))\3at(?=(\s+))\4[^\n]{1,100}$/i, '')
        .replace(/(?=(\s+))\1purchase(?=(\s+))\2at(?=(\s+))\3[^\n]{1,100}$/i, '')
        
        // Remove common German phrases and store codes
        .replace(/(?=(\s+))\1SAGT(?=(\s+))\2DANKE?\.?(?=(\s*))\3\d{0,10}$/i, '')
        .replace(/(?=(\s+))\1BEDANKT(?=(\s+))\2SICH$/i, '')
        .replace(/(?=(\s+))\1SAGT(?=(\s+))\2DANK$/i, '')
        
        // Remove store/branch codes and patterns
        .replaceAll(/(?=(\s+))\1H:\d{1,10}/g, '')
        .replaceAll(/(?=(\s+))\1FIL\.\d{1,10}/g, '')
        .replaceAll(/(?=(\s+))\1R\d{3,5}/g, '')
        .replaceAll(/(?=(\s+))\1GIR(?=(\s+))\2\d{1,10}/g, '')
        .replaceAll(/(?=(\s+))\1\d{8,15}/g, '')
        
        // Remove alphanumeric transaction/reference codes (like Urban Sports codes)
        .replaceAll(/(?=(\s+))\1[A-Z0-9]{15,30}$/g, '')
        .replaceAll(/(?=(\s+))\1[A-Z0-9]{10,20}(?:[A-Z0-9]{1,10})?$/g, '')
        
        // Remove payment method descriptions
        .replace(/(?=(\s+))\1Lastschrift(?=(\s+))\2aus(?=(\s+))\3Kartenzahlung[^\n]{0,100}$/i, '')
        
        // Clean business name patterns
        .replace(/(?=(\s+))\1U(?=(\s+))\2CO(?=(\s+))\3KG[^\n]{0,100}$/, ' & Co KG')
        .replace(/(?=(\s+))\1FIL(?=(\s+))\2\d{1,10}[^\n]{1,200}$/, '')
        
        // Specific merchant name improvements
        .replace(/^DM(?=(\s+))\1[^\n]{1,100}$/, 'DM Drogeriemarkt')
        .replace(/^KARSTADT(?=(\s+))\1LEBENSM\.[^\n]{1,100}$/, 'Karstadt')
        .replace(/^KARSTADT(?:[^\n]{1,100})?$/, 'Karstadt')
        .replace(/^REWE(?=(\s+))\1[^\n]{1,100}$/, 'REWE')
        .replace(/^SPOTIFY(?=(\s+))\1[^\n]{1,100}$/, 'Spotify')
        .replace(/^UBER(?=(\s+))\1BV[^\n]{1,100}$/, 'Uber')
        .replace(/^APPLE(?=(\s+))\1STORE[^\n]{1,100}$/, 'Apple Store')
        
        // Clean up complex patterns that still have locations/descriptions
        .replace(/^([A-Z][A-Za-z\s&.-]{1,100})\/\/[^\n]{1,100}$/, '$1')
        .replace(/^([A-Z][A-Za-z\s&.-]{1,100})(?=(\s+))\2\/(?=(\s+))\3[^\n]{1,100}$/, '$1')
        
        // Remove trailing business suffixes when they're redundant and normalize case
        .replace(/(?=(\s+))\1GMBH$/i, ' GmbH')
        .replace(/(?=(\s+))\1UG$/i, ' UG')
        .replace(/(?=(\s+))\1SPA$/i, ' SpA')
        .replace(/(?=(\s+))\1SRL$/i, ' SRL')
        
        // Clean up multiple spaces and trim
        .replaceAll(/(?=(\s+))\1/g, ' ')
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

// Delegate to ESM script that uses top-level await
const { spawnSync } = require('node:child_process')

const args = [path.join(__dirname, 'update-pipe-titles.mjs'), ...process.argv.slice(2)]
const result = spawnSync(process.execPath, args, { stdio: 'inherit' })
process.exit(result.status === null ? 1 : result.status)
#!/usr/bin/env node

/**
 * NodeJS script to find all transaction titles containing "||" characters
 * This script connects to the Supabase database and queries for transactions
 */

const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')
const path = require('node:path')

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') })

// Check for verbose flag
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

async function findTransactionsWithPipes() {
  try {
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      console.log('📋 Find Transactions with Pipe Characters (||)')
      console.log('')
      console.log('Usage:')
      console.log('  npm run find-pipe-titles           # Simple output (title + new title)')
      console.log('  npm run find-pipe-titles -- --verbose  # Detailed output with all fields')
      console.log('  npm run find-pipe-titles -- -v         # Short verbose flag')
      console.log('  npm run find-pipe-titles -- --help     # Show this help')
      console.log('')
      console.log('Description:')
      console.log('  This script finds all transactions with "||" in their titles and extracts')
      console.log('  clean merchant names from the transaction data.')
      process.exit(0)
    }

    const outputMode = isVerbose ? 'verbose' : 'simple'
    console.log(`🔍 Searching for transactions with "||" in titles... (${outputMode} mode)\n`)

    // Query transactions where title contains "||"
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('id, title, date, amount, currency, main_category, sub_category, user_id')
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

    console.log(`📊 Found ${transactions.length} transaction(s) with "||" in title:\n`)

    // Helper function to extract substring between first and second "||"
    function extractNewTitle(title) {
      const firstIndex = title.indexOf('||')
      if (firstIndex === -1) return 'N/A'
      
      const secondIndex = title.indexOf('||', firstIndex + 2)
      if (secondIndex === -1) {
        // If there's no second "||", return everything after the first one
        return title.substring(firstIndex + 2).trim()
      }
      
      const merchantName = title.substring(firstIndex + 2, secondIndex).trim()
      
      // Special handling for PayPal transactions - extract text after second "||"
      if (merchantName.toLowerCase().includes('paypal')) {
        const textAfterSecondPipe = title.substring(secondIndex + 2).trim()
        
        // Extract meaningful part from PayPal transaction description
        // Common patterns: "PP.3012.PP . MERCHANTNAME" or ". MERCHANTNAME"
        const match = textAfterSecondPipe.match(/(?:PP\.\d+\.PP\s*\.\s*|^\.\s*)([A-Z][A-Za-z0-9\s&.-]+?)(?:\s+Ihr\s+Einkauf|$)/)
        if (match && match[1]) {
          return match[1].trim()
        }
        
        // Fallback: return first meaningful part after cleaning common PayPal prefixes
        const cleaned = textAfterSecondPipe
          .replace(/^PP\.\d+\.PP\s*\.\s*/, '')
          .replace(/^\.\s*/, '')
          .replace(/\s+Ihr\s+Einkauf.*$/, '')
          .replace(/\s+AWV-MELDEPFLICHT.*$/, '')
          .trim()
        
        return cleaned || textAfterSecondPipe
      }
      
      // Special handling for ADYEN transactions - extract text after second "||"
      if (merchantName.toLowerCase().includes('adyen')) {
        const textAfterSecondPipe = title.substring(secondIndex + 2).trim()
        
        // Extract meaningful part from ADYEN transaction description
        // Common pattern: "Urban Sports GmbH 100082136  L  01 Nov  2019..."
        const match = textAfterSecondPipe.match(/^([A-Za-z0-9\s&.-]+?)(?:\s+\d+|\s+L\s|\s+AWV-MELDEPFLICHT|$)/)
        if (match && match[1]) {
          return match[1].trim()
        }
        
        // Fallback: return first part before numbers or specific keywords
        const cleaned = textAfterSecondPipe
          .replace(/\s+\d+.*$/, '')
          .replace(/\s+L\s.*$/, '')
          .replace(/\s+AWV-MELDEPFLICHT.*$/, '')
          .trim()
        
        return cleaned || textAfterSecondPipe
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
        .replace(/\s+Your\s+purchase\s+at\s+(.+)$/i, '') // "SPOTIFY Your purchase at SPOTIFY" -> "SPOTIFY"
        .replace(/\s+purchase\s+at\s+.+$/i, '')
        
        // Remove common German phrases and store codes
        .replace(/\s+SAGT\s+DANKE?\.?\s*\d*$/i, '')
        .replace(/\s+BEDANKT\s+SICH$/i, '')
        .replace(/\s+SAGT\s+DANK$/i, '')
        
        // Remove store/branch codes and patterns
        .replace(/\s+H:\d+/g, '')
        .replace(/\s+FIL\.\d+/g, '')
        .replace(/\s+R\d{3,}/g, '') // Remove codes like "R358"
        .replace(/\s+GIR\s+\d+/g, '')
        .replace(/\s+\d{8,}/g, '') // Remove long number sequences
        
        // Remove alphanumeric transaction/reference codes (like Urban Sports codes)
        .replace(/\s+[A-Z0-9]{15,}$/g, '') // Remove long alphanumeric codes at the end
        .replace(/\s+[A-Z0-9]{10,}[A-Z0-9]*$/g, '') // Remove medium-long codes
        
        // Remove payment method descriptions
        .replace(/\s+Lastschrift\s+aus\s+Kartenzahlung.*$/i, '')
        
        // Clean business name patterns
        .replace(/\s+U\s+CO\s+KG.*$/, ' & Co KG') // "GMBH U CO KG FIL 1" -> "GMBH & Co KG"
        .replace(/\s+FIL\s+\d+.*$/, '') // Remove "FIL 1" and everything after
        
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
        
        // Remove trailing business suffixes when they're redundant and normalize case
        .replace(/\s+GMBH$/i, ' GmbH')
        .replace(/\s+UG$/i, ' UG')
        .replace(/\s+SPA$/i, ' SpA')
        .replace(/\s+SRL$/i, ' SRL')
        
        // Clean up multiple spaces and trim
        .replace(/\s+/g, ' ')
        .trim()
    }

    // Display results in a formatted table
    for (let index = 0; index < transactions.length; index++) {
      const transaction = transactions[index]
      const rawTitle = extractNewTitle(transaction.title)
      const newTitle = cleanTitle(rawTitle)
      
      if (isVerbose) {
        // Verbose output - show all details
        console.log(`${index + 1}. Transaction ID: ${transaction.id}`)
        console.log(`   Title: "${transaction.title}"`)
        console.log(`   New Title: "${newTitle}"`)
        console.log(`   Date: ${new Date(transaction.date).toLocaleDateString()}`)
        console.log(`   Amount: ${transaction.amount} ${transaction.currency}`)
        console.log(`   Category: ${transaction.main_category} > ${transaction.sub_category}`)
        console.log(`   User ID: ${transaction.user_id}`)
        console.log('   ' + '-'.repeat(60))
      } else {
        // Simple output - just title, new title, and separator
        console.log(`${index + 1}. Title: "${transaction.title}"`)
        console.log(`   New Title: "${newTitle}"`)
        console.log('   ' + '-'.repeat(50))
      }
    }

    console.log(`\n📈 Summary: ${transactions.length} transactions contain "||" in their titles`)

    // Analyze extracted titles
    const newTitles = transactions.map(t => cleanTitle(extractNewTitle(t.title))).filter(title => title !== 'N/A')
    const uniqueNewTitles = [...new Set(newTitles)]
    
    console.log(`\n🏷️ New Title Analysis:`)
    console.log(`   Total extracted titles: ${newTitles.length}`)
    console.log(`   Unique extracted titles: ${uniqueNewTitles.length}`)
    
    // Show most common extracted titles
    const titleCounts = newTitles.reduce((acc, title) => {
      acc[title] = (acc[title] || 0) + 1
      return acc
    }, {})
    
    const sortedTitles = Object.entries(titleCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
    
    if (sortedTitles.length > 0) {
      console.log(`\n🔝 Top 10 Most Common New Titles:`)
      for (let i = 0; i < sortedTitles.length; i++) {
        const [title, count] = sortedTitles[i]
        console.log(`   ${i + 1}. "${title}" (${count} times)`)
      }
    }

    // Group by user if multiple users
    const userCounts = transactions.reduce((acc, t) => {
      acc[t.user_id] = (acc[t.user_id] || 0) + 1
      return acc
    }, {})

    if (Object.keys(userCounts).length > 1) {
      console.log('\n👥 By User:')
      for (const [userId, count] of Object.entries(userCounts)) {
        console.log(`   User ${userId}: ${count} transactions`)
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
    process.exit(1)
  }
}

// Run the script without promise chain
(async () => {
  try {
    await findTransactionsWithPipes()
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  } catch (error) {
    console.error('❌ Script failed:', error.message)
    process.exit(1)
  }
})()

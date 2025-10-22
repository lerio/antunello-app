#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

// Limit regex input to avoid potential ReDoS on untrusted/long strings
const MAX_REGEX_INPUT = 512
const clampRegexInput = (s) => (typeof s === 'string' && s.length > MAX_REGEX_INPUT ? s.slice(0, MAX_REGEX_INPUT) : s)

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
      // Clamp the input title to prevent ReDoS
      const clampedTitle = clampRegexInput(title);
      
      const firstIndex = clampedTitle.indexOf('||')
      if (firstIndex === -1) return 'N/A'
      
      const secondIndex = clampedTitle.indexOf('||', firstIndex + 2)
      if (secondIndex === -1) {
        // If there's no second "||", return everything after the first one
        return clampedTitle.substring(firstIndex + 2).trim()
      }
      
      const merchantName = clampedTitle.substring(firstIndex + 2, secondIndex).trim()
      
      // Special handling for PayPal transactions - extract text after second "||"
      if (merchantName.toLowerCase().includes('paypal')) {
        const rawAfter = clampedTitle.substring(secondIndex + 2).trim()
        const textAfterSecondPipe = clampRegexInput(rawAfter)
        
        // Extract meaningful part from PayPal transaction description
        // Common patterns: "PP.3012.PP . MERCHANTNAME" or ". MERCHANTNAME"
        // Use more specific patterns to avoid catastrophic backtracking
        const match = textAfterSecondPipe.match(/^(?:\.|PP\.\d{1,4}\.PP\.\s+)?([A-Z][A-Za-z0-9\s&.-]{1,100})(?:\s+Ihr\s+Einkauf\b)?$/)
        if (match && match[1]) {
          return clampRegexInput(match[1].trim())
        }
        
        // Fallback: return first meaningful part after cleaning common PayPal prefixes
        const cleaned = textAfterSecondPipe
          .replace(/^PP\.\d{1,4}\.PP(?=(\s+))\1\.(?=(\s+))\2/, '')
          .replace(/^\.(?=(\s+))\1/, '')
          .replace(/(?=(\s+))\1Ihr(?=(\s+))\2Einkauf\b[^\n]{0,100}$/, '')
          .replace(/(?=(\s+))\1AWV-MELDEPFLICHT\b[^\n]{0,100}$/, '')
          .trim()
        
        return clampRegexInput(cleaned || textAfterSecondPipe)
      }
      
      // Special handling for ADYEN transactions - extract text after second "||"
      if (merchantName.toLowerCase().includes('adyen')) {
        const rawAfter = clampedTitle.substring(secondIndex + 2).trim()
        const textAfterSecondPipe = clampRegexInput(rawAfter)
        
        // Extract meaningful part from ADYEN transaction description
        // Use possessive quantifiers where possible (emulated with atomic groups)
        const match = textAfterSecondPipe.match(/^([A-Za-z0-9\s&.-]{1,100})(?:\s+(?:\d{1,10}|L|AWV-MELDEPFLICHT)\b|$)/)
        if (match && match[1]) {
          return clampRegexInput(match[1].trim())
        }
        
        // Fallback: return first part before numbers or specific keywords
        const cleaned = textAfterSecondPipe
          .replace(/\s+\d{1,10}\b.*$/, '')
          .replace(/\s+L\b.*$/, '')
          .replace(/\s+AWV-MELDEPFLICHT\b.*$/, '')
          .trim()
        
        return clampRegexInput(cleaned || textAfterSecondPipe)
      }
      
      return merchantName
    }

    // Clean the extracted title from common strings and patterns
    function cleanTitle(title) {
      const input = clampRegexInput(title)
      // Apply replacements in a safe manner with bounded quantifiers and atomic groups
      return input
        // Remove location patterns like "//BERLIN/DE" or "//Berlin Wedding/DE"
        .replaceAll(/\/\/[^/]{1,50}\/[A-Z]{2}(?:\/\d{1,10})?(?=(\s+))\1\/[^\n]{0,200}$/i, '')
        .replaceAll(/\/\/[^/]{1,50}\/[A-Z]{2}$/i, '')
        
        // Remove common purchase/transaction phrases
        .replaceAll(/(?=(\s+))\1Your(?=(\s+))\2purchase(?=(\s+))\3at(?=(\s+))\4[^\n]{1,100}$/i, '')
        .replaceAll(/(?=(\s+))\1purchase(?=(\s+))\2at(?=(\s+))\3[^\n]{1,100}$/i, '')
        
        // Remove common German phrases and store codes
        .replaceAll(/(?=(\s+))\1SAGT(?=(\s+))\2DANKE?\.?(?=(\s*))\3\d{0,10}$/i, '')
        .replaceAll(/(?=(\s+))\1BEDANKT(?=(\s+))\2SICH$/i, '')
        .replaceAll(/(?=(\s+))\1SAGT(?=(\s+))\2DANK$/i, '')
        
        // Remove store/branch codes and patterns
        .replaceAll(/(?=(\s+))\1H:\d{1,10}/g, '')
        .replaceAll(/(?=(\s+))\1FIL\.\d{1,10}/g, '')
        .replaceAll(/(?=(\s+))\1R\d{3,5}/g, '')
        .replaceAll(/(?=(\s+))\1GIR(?=(\s+))\2\d{1,10}/g, '')
        .replaceAll(/(?=(\s+))\1\d{8,15}/g, '')
        
        // Remove alphanumeric transaction/reference codes
        .replaceAll(/(?=(\s+))\1[A-Z0-9]{15,30}$/g, '')
        .replaceAll(/(?=(\s+))\1[A-Z0-9]{10,20}$/g, '')
        
        // Remove payment method descriptions
        .replace(/(?=(\s+))\1Lastschrift(?=(\s+))\2aus(?=(\s+))\3Kartenzahlung\b[^\n]{0,100}$/i, '')
        
        // Clean business name patterns
        .replace(/(?=(\s+))\1U(?=(\s+))\2CO(?=(\s+))\3KG\b[^\n]{0,100}$/, ' & Co KG')
        .replace(/(?=(\s+))\1FIL(?=(\s+))\2\d{1,10}\b[^\n]{0,100}$/, '')
        
        // Specific merchant name improvements
        .replace(/^DM(?=(\s+))\1[^\n]{0,100}$/, 'DM Drogeriemarkt')
        .replace(/^KARSTADT(?=(\s+))\1LEBENSM\.\b[^\n]{0,100}$/, 'Karstadt')
        .replace(/^KARSTADT\b[^\n]{0,100}$/, 'Karstadt')
        .replace(/^REWE(?=(\s+))\1[^\n]{0,100}$/, 'REWE')
        .replace(/^SPOTIFY(?=(\s+))\1[^\n]{0,100}$/, 'Spotify')
        .replace(/^UBER(?=(\s+))\1BV\b[^\n]{0,100}$/, 'Uber')
        .replace(/^APPLE(?=(\s+))\1STORE\b[^\n]{0,100}$/, 'Apple Store')
        
        // Clean up complex patterns
        .replace(/^([A-Z][A-Za-z\s&.-]{1,100})\/\/[^\n]{0,100}$/, '$1')
        .replace(/^([A-Z][A-Za-z\s&.-]{1,100}?)(?=(\s+))\2\/(?=(\s+))\3[^\n]{0,100}$/, '$1')
        
        // Remove trailing business suffixes
        .replace(/(?=(\s+))\1GMBH\b$/i, ' GmbH')
        .replace(/(?=(\s+))\1UG\b$/i, ' UG')
        .replace(/(?=(\s+))\1SPA\b$/i, ' SpA')
        .replace(/(?=(\s+))\1SRL\b$/i, ' SRL')
        
        // Clean up multiple spaces and trim
        .replaceAll(/(?=(\s+))\1/g, ' ')
        .trim()
    }

    // Display results in a formatted table
    for (const [index, transaction] of transactions.entries()) {
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
      for (const [index, [title, count]] of sortedTitles.entries()) {
        console.log(`   ${index + 1}. "${title}" (${count} times)`)
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

await findTransactionsWithPipes()
console.log('\n✅ Script completed successfully')
process.exit(0)
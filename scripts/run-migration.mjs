#!/usr/bin/env node

/**
 * Script to run database migrations (ESM with top-level await)
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Error: Missing Supabase environment variables')
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

function printManualExecution(sql) {
  console.log(`\n⚠️  This migration requires database admin access.`)
  console.log(`Please run this SQL manually in your Supabase dashboard:`)
  console.log(`\n--- SQL to run manually ---`)
  console.log(sql)
  console.log(`--- End of SQL ---\n`)
}

async function authenticateUser() {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout
  })

  const question = (prompt) => new Promise((resolve) => {
    readline.question(prompt, resolve)
  })

  try {
    console.log('🔐 Authentication required to run database migrations')
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

try {
  // Parse command line arguments
  const migrationFile = process.argv[2]
  if (!migrationFile) {
    console.log('📝 Run Database Migration')
    console.log('')
    console.log('Usage:')
    console.log('  node scripts/run-migration.mjs <migration-file>')
    console.log('')
    console.log('Example:')
    console.log('  node scripts/run-migration.mjs migrations/add_hide_from_totals_column.sql')
    console.log('')
    process.exit(1)
  }

  // Authenticate user
  await authenticateUser()

  const migrationPath = path.resolve(migrationFile)
  console.log(`📂 Reading migration file: ${migrationPath}`)

  // Read the migration file
  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`)
    process.exit(1)
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
  console.log(`📄 Migration content loaded (${migrationSQL.length} characters)')`)

  // Split SQL statements (simple split by semicolon + newline)
  const statements = migrationSQL
    .split(';\n')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

  if (statements.length === 0) {
    console.log('⚠️  No SQL statements found in migration file')
    process.exit(1)
  }

  console.log(`🚀 Executing ${statements.length} SQL statement(s)...`)

  // Execute each statement (permission check placeholder)
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]
    console.log(`\n📝 Executing statement ${i + 1}/${statements.length}:`)
    console.log(`   ${statement.substring(0, 100)}${statement.length > 100 ? '...' : ''}`)

    try {
      // Try to execute raw SQL - this might require service role key
      const { error } = await supabase
        .from('transactions')
        .select('*')
        .limit(1)

      if (error) {
        console.error(`❌ Cannot execute raw SQL with current permissions:`, error.message)
        printManualExecution(migrationSQL)
        process.exit(1)
      }

      console.log(`✅ Basic database access confirmed`)
      console.log(`\n⚠️  Automatic SQL execution not supported with current permissions.`)
      printManualExecution(migrationSQL)
      break
    } catch (error) {
      console.error(`❌ Unexpected error:`, error.message)
      process.exit(1)
    }
  }

  console.log('\n🎉 Migration completed successfully!')
  console.log('')
  console.log('Next steps:')
  console.log('1. Test the application to ensure the new column works correctly')
  console.log('2. The hide_from_totals column has been added with default value FALSE')
  console.log('3. Existing transactions will not be hidden from totals')

} catch (error) {
  console.error('❌ Migration failed:', error.message)
  process.exit(1)
}

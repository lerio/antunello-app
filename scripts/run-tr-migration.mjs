#!/usr/bin/env node

/**
 * Run the Trade Republic provider migration.
 * Uses the Supabase SQL API with the service role key.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL in .env.local');
  process.exit(1);
}

const migrationPath = path.join(__dirname, '..', 'migrations', '012_add_trade_republic_provider.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

console.log('📄 Running migration: 012_add_trade_republic_provider.sql');
console.log('---');
console.log(sql.trim());
console.log('---\n');

try {
  // Use the Supabase SQL API (available to service role)
  const response = await fetch(`${url}/rest/v1/sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'apikey': key,
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await response.text();

  if (response.ok) {
    console.log('✅ Migration applied successfully!');
    if (text && text !== '[]') console.log('Response:', text);
  } else {
    // The /rest/v1/sql endpoint may not be available on all projects.
    // Fall back to printing the SQL for manual execution.
    if (response.status === 404 || response.status === 400) {
      console.log('⚠️  The /rest/v1/sql endpoint is not available on this Supabase project.');
      console.log('Please run this SQL manually in the Supabase SQL Editor:');
      console.log(`\n1. Go to https://supabase.com/dashboard/project/nucetcfyhupbiiufqhbi/sql/new`);
      console.log('2. Paste the SQL above and click "Run"\n');
    } else {
      console.error(`❌ API error (${response.status}):`, text);
      process.exit(1);
    }
  }
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
}

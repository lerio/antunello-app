#!/usr/bin/env node

/**
 * Import Trade Republic transactions from pytr JSON output into Supabase.
 *
 * Reads newline-delimited JSON from /tmp/tr-transactions.json (produced by
 * the GitHub Actions workflow), deduplicates against existing transactions
 * and pending_transactions, then inserts new entries.
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL    - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY   - Service role key (bypasses RLS)
 *
 * Optional env vars:
 *   TR_USER_ID                  - The Supabase user UUID to associate with
 *   TR_FUND_CATEGORY_ID         - Fund category ID for mapping
 */

import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userId = process.env.TR_USER_ID;
const fundCategoryId = process.env.TR_FUND_CATEGORY_ID || null;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!userId) {
  console.error('Missing TR_USER_ID — set the Supabase user UUID to associate transactions with');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const toISODate = (dateStr) => new Date(dateStr).toISOString().split('T')[0];

/** Map pytr transaction type to app type (income/expense). */
function mapToAppType(pytrType, value) {
  switch ((pytrType || '').toLowerCase()) {
    case 'deposit':
    case 'addition':
    case 'sell':
    case 'dividend':
    case 'interest':
      return 'income';
    case 'removal':
    case 'buy':
    default:
      return value < 0 ? 'expense' : 'income';
  }
}

/** Generate dedup signature from amount + date + currency. */
function signature(amount, date, currency) {
  return `${parseFloat(String(amount)).toFixed(2)}_${toISODate(date)}_${currency}`;
}

async function main() {
  console.log('Reading transactions from /tmp/tr-transactions.json...');

  let raw;
  try {
    raw = await readFile('/tmp/tr-transactions.json', 'utf-8');
  } catch {
    console.error('No transaction file found at /tmp/tr-transactions.json');
    process.exit(1);
  }

  if (!raw.trim()) {
    console.log('Transaction file is empty. Nothing to import.');
    process.exit(0);
  }

  // Parse NDJSON (one JSON object per line).
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  const pytrTransactions = [];

  for (const line of lines) {
    try {
      pytrTransactions.push(JSON.parse(line));
    } catch {
      console.warn('Skipping invalid JSON line:', line.substring(0, 80));
    }
  }

  if (pytrTransactions.length === 0) {
    console.log('No valid JSON transactions found.');
    process.exit(0);
  }

  console.log(`Parsed ${pytrTransactions.length} transactions from pytr.`);

  // Fetch existing pending transaction IDs for dedup.
  const { data: existingPending } = await supabase
    .from('pending_transactions')
    .select('external_id')
    .eq('user_id', userId);

  const existingPendingIds = new Set((existingPending || []).map((p) => p.external_id));

  // Fetch existing transaction signatures for dedup.
  const { data: existingTxns } = await supabase
    .from('transactions')
    .select('amount, date, currency')
    .eq('user_id', userId);

  const existingSignatures = new Set(
    (existingTxns || []).map((t) => signature(t.amount, t.date, t.currency)),
  );

  // Map and deduplicate.
  const newPending = [];

  for (const item of pytrTransactions) {
    const pytrType = item.Type || '';
    const value = item.Value;
    const amount = value != null ? Math.abs(value) : 0;
    const currency = 'EUR';
    const date = item.Date || '';
    const title = item.Note || 'TR Transaction';
    const isin = item.ISIN || null;

    // Skip transactions with no value (e.g. dividend events with null Value).
    if (value == null) continue;

    // Generate external_id from date + note + value (same as client.ts).
    const externalId = `${date}_${title}_${value}`;

    if (existingPendingIds.has(externalId)) continue;

    const sig = signature(amount, date, currency);
    if (existingSignatures.has(sig)) continue;

    const appType = mapToAppType(pytrType, value);

    newPending.push({
      user_id: userId,
      external_id: externalId,
      data: {
        amount,
        currency,
        date,
        title,
        type: appType,
        account_iban: null,
        fund_category_id: fundCategoryId,
        original_amount: value,
        tr_type: pytrType,
        isin,
        shares: item.Shares || null,
        fees: item.Fees || null,
        taxes: item.Taxes || null,
      },
      status: 'pending',
    });
  }

  if (newPending.length === 0) {
    console.log('No new transactions to import.');
  } else {
    const { error } = await supabase
      .from('pending_transactions')
      .insert(newPending);

    if (error) {
      console.error('Insert error:', error);
      process.exit(1);
    }

    console.log(`Imported ${newPending.length} new pending transactions.`);
  }

  // Update last_sync_at on the integration config.
  const { error: updateError } = await supabase
    .from('integration_configs')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('provider', 'trade_republic');

  if (updateError) {
    console.warn('Failed to update last_sync_at:', updateError.message);
  }
}

main().catch((e) => {
  console.error('Import failed:', e);
  process.exit(1);
});

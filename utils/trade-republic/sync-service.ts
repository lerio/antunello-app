/**
 * Trade Republic sync service for importing transactions.
 *
 * Provides the sync function that fetches TR transactions via the
 * TradeRepublicClient, deduplicates them against existing transactions in
 * the local database, and stores new ones as pending transactions for user
 * review and approval.
 *
 * Follows the same pattern as the Enable Banking sync service
 * (utils/enable-banking/sync-service.ts) so both providers feed the same
 * pending_transactions pipeline.
 *
 * @module utils/trade-republic/sync-service
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { TradeRepublicClient } from './client';
import type { TRSettings } from './types';

/**
 * Minimal integration config shape needed by the sync function.
 * Mirrors the Enable Banking IntegrationConfig but accesses settings
 * as a generic record since TR stores different fields.
 */
interface TRIntegrationConfig {
  id: string;
  user_id: string;
  account_id: string;
  provider: string;
  last_sync_at?: string | null;
  settings?: Record<string, unknown> | null;
}

/**
 * Converts a date string to ISO YYYY-MM-DD format.
 */
const toISODate = (dateStr: string): string => {
  return new Date(dateStr).toISOString().split('T')[0];
};

/**
 * Synchronise TR transactions from a configured Trade Republic account
 * into the application's pending_transactions table.
 *
 * The function:
 * 1. Deserialises session cookies from config.settings
 * 2. Checks if the session is expired
 * 3. Fetches transactions from the TR API
 * 4. Maps TR transactions to the app's pending_transactions format
 * 5. Deduplicates against existing transactions and pending transactions
 * 6. Inserts new, unique transactions as pending entries
 * 7. Updates the integration config's last_sync_at timestamp
 *
 * @param supabase - A Supabase client instance for database operations.
 * @param config - The integration configuration row from integration_configs.
 * @returns A result object with account, fetched count, new pending count,
 *          and optionally an error message on failure.
 */
export async function syncTradeRepublicAccount(
  supabase: SupabaseClient,
  config: TRIntegrationConfig,
): Promise<{ account: string; fetched?: number; new_pending?: number; error?: string }> {
  try {
    const settings = (config.settings || {}) as Partial<TRSettings>;

    // pytr manages its own session cookies in ~/.pytr/.
    const client = new TradeRepublicClient();

    // 2. Determine fetch window
    const fetchFrom = config.last_sync_at
      ? new Date(config.last_sync_at)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // 3. Fetch from TR
    const fetchedTransactions = await client.getTransactions(fetchFrom);

    if (fetchedTransactions.length === 0) {
      // Update last_sync_at even when no new transactions found.
      await supabase
        .from('integration_configs')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', config.id);

      return { account: config.account_id, fetched: 0, new_pending: 0 };
    }

    // 4. Deduplicate against existing records
    const fromDateStr = toISODate(fetchFrom.toISOString());

    const { data: existingTransactions } = await supabase
      .from('transactions')
      .select('amount, date, currency')
      .eq('user_id', config.user_id)
      .gte('date', fromDateStr);

    const { data: existingPending } = await supabase
      .from('pending_transactions')
      .select('external_id')
      .eq('user_id', config.user_id);

    const existingTxSignature = new Set(
      (existingTransactions || []).map(
        (t) => `${parseFloat(String(t.amount)).toFixed(2)}_${toISODate(t.date)}_${t.currency}`,
      ),
    );

    const existingPendingIds = new Set(
      (existingPending || []).map((p) => p.external_id),
    );

    // 5. Map TR transactions to pending_transactions format
    const newPendingTransactions: Array<{
      user_id: string;
      external_id: string;
      data: Record<string, unknown>;
      status: string;
    }> = [];

    for (const tx of fetchedTransactions) {
      // Skip if already present as a pending transaction.
      if (existingPendingIds.has(tx.id)) continue;

      const txAmount = tx.amount;
      const date = toISODate(tx.date);
      const signature = `${txAmount.toFixed(2)}_${date}_${tx.currency}`;

      // Skip if already present as a confirmed transaction.
      if (existingTxSignature.has(signature)) continue;

      // Map TR transaction type to app type (expense / income).
      const appType = mapToAppType(tx.type);

      const fundCategoryId = settings.fund_category_id || null;

      newPendingTransactions.push({
        user_id: config.user_id,
        external_id: tx.id,
        data: {
          amount: txAmount,
          currency: tx.currency,
          date: tx.date,
          title: tx.title,
          type: appType,
          account_iban: null, // TR doesn't have IBANs for individual transactions.
          fund_category_id: fundCategoryId,
          original_amount: tx.amount,
          // TR-specific metadata preserved for reference.
          tr_type: tx.type,
          isin: tx.isin || null,
          instrument_name: tx.instrumentName || null,
          shares: tx.shares || null,
          price_per_share: tx.pricePerShare || null,
        },
        status: 'pending',
      });
    }

    // 6. Insert into pending_transactions
    if (newPendingTransactions.length > 0) {
      const { error: insertError } = await supabase
        .from('pending_transactions')
        .insert(newPendingTransactions);

      if (insertError) throw insertError;
    }

    // 7. Update last_sync_at
    await supabase
      .from('integration_configs')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', config.id);

    return {
      account: config.account_id,
      fetched: fetchedTransactions.length,
      new_pending: newPendingTransactions.length,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Detect session expiry errors and update auth_status so the UI can
    // prompt for re-authentication.
    if (message.includes('session expired') || message.includes('Re-authenticate')) {
      try {
        const currentSettings = (config.settings || {}) as Record<string, unknown>;
        await supabase
          .from('integration_configs')
          .update({
            settings: { ...currentSettings, auth_status: 'session_expired' },
          })
          .eq('id', config.id);
      } catch {
        // Best-effort update — don't mask the original error.
      }
    }

    console.error(`TR sync failed for config ${config.id}:`, error);
    return { account: config.account_id, error: message };
  }
}

/**
 * Map a Trade Republic transaction type to the application's type field
 * ('income' or 'expense').
 */
function mapToAppType(trType: string): 'income' | 'expense' {
  switch (trType) {
    case 'DEPOSIT':
    case 'SELL':
    case 'DIVIDEND':
    case 'INTEREST':
    case 'TAX_REFUND':
      return 'income';
    case 'CARD_PAYMENT':
    case 'WITHDRAWAL':
    case 'BUY':
    case 'SAVINGS_PLAN':
    case 'FEE':
    default:
      return 'expense';
  }
}

/**
 * Trade Republic sync service — calls Render Python microservice.
 *
 * Reads phone + PIN + cookies from integration_configs.settings,
 * calls the Render service to fetch transactions, deduplicates,
 * and inserts into pending_transactions.
 *
 * @module utils/trade-republic/sync-service
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { TradeRepublicClient } from './client';
import type { TRTransaction } from './types';

const toISODate = (d: string): string => new Date(d).toISOString().split('T')[0];

export interface TRConfig {
  id: string;
  user_id: string;
  account_id: string;
  provider: string;
  last_sync_at?: string | null;
  settings?: Record<string, unknown> | null;
}

export async function syncTradeRepublicAccount(
  supabase: SupabaseClient,
  config: TRConfig,
): Promise<{ account: string; fetched?: number; new_pending?: number; error?: string }> {
  try {
    const s = (config.settings || {}) as Record<string, unknown>;
    const cookiesB64 = (s.session_cookies as string) || '';

    if (!cookiesB64) {
      return { account: config.account_id, error: 'Missing session. Re-authenticate.' };
    }

    const fetchFrom = config.last_sync_at
      ? new Date(config.last_sync_at)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    let result: { transactions: TRTransaction[]; cookies: string };
    try {
      result = await TradeRepublicClient.getTransactions(cookiesB64, fetchFrom);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      if (msg.includes('auth_required')) {
        await supabase
          .from('integration_configs')
          .update({ settings: { ...s, auth_status: 'session_expired' } })
          .eq('id', config.id);
        return { account: config.account_id, error: 'auth_required' };
      }
      throw e;
    }

    // Save updated cookies.
    if (result.cookies !== cookiesB64) {
      await supabase
        .from('integration_configs')
        .update({ settings: { ...s, session_cookies: result.cookies } })
        .eq('id', config.id);
    }

    const fetched = result.transactions;

    if (fetched.length === 0) {
      await supabase
        .from('integration_configs')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', config.id);
      return { account: config.account_id, fetched: 0, new_pending: 0 };
    }

    const fromDateStr = toISODate(fetchFrom.toISOString());

    const { data: existingTxns } = await supabase
      .from('transactions')
      .select('amount, date, currency')
      .eq('user_id', config.user_id)
      .gte('date', fromDateStr);

    const { data: existingPending } = await supabase
      .from('pending_transactions')
      .select('external_id')
      .eq('user_id', config.user_id);

    const existingSigs = new Set(
      (existingTxns || []).map(
        (t) => `${parseFloat(String(t.amount)).toFixed(2)}_${toISODate(t.date)}_${t.currency}`,
      ),
    );
    const existingIds = new Set((existingPending || []).map((p) => p.external_id));

    const fundId = (s.fund_category_id as string) || null;
    const newPending: Array<Record<string, unknown>> = [];

    for (const tx of fetched) {
      if (existingIds.has(tx.id)) continue;
      const date = toISODate(tx.date);
      const sig = `${tx.amount.toFixed(2)}_${date}_${tx.currency}`;
      if (existingSigs.has(sig)) continue;

      const appType = ['DEPOSIT', 'SELL', 'DIVIDEND', 'INTEREST'].includes(tx.type)
        ? 'income'
        : 'expense';

      newPending.push({
        user_id: config.user_id,
        external_id: tx.id,
        data: {
          amount: tx.amount,
          currency: tx.currency,
          date: tx.date,
          title: tx.title,
          type: appType,
          fund_category_id: fundId,
          tr_type: tx.type,
          isin: tx.isin || null,
          instrument_name: tx.instrumentName || null,
          shares: tx.shares || null,
          price_per_share: tx.pricePerShare || null,
        },
        status: 'pending',
      });
    }

    if (newPending.length > 0) {
      const { error } = await supabase.from('pending_transactions').insert(newPending);
      if (error) throw error;
    }

    await supabase
      .from('integration_configs')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', config.id);

    return {
      account: config.account_id,
      fetched: fetched.length,
      new_pending: newPending.length,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`TR sync failed for ${config.id}:`, error);
    return { account: config.account_id, error: msg };
  }
}

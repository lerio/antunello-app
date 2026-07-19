/**
 * Trade Republic sync service — delegates to Render microservice.
 *
 * The Render service handles pytr + Supabase import. The Next.js API route
 * just passes credentials to Render and returns the result.
 *
 * @module utils/trade-republic/sync-service
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { TradeRepublicClient } from './client';

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

    const lastDays = config.last_sync_at
      ? Math.max(1, Math.ceil((Date.now() - new Date(config.last_sync_at).getTime()) / 86400000))
      : 7;

    const result = await TradeRepublicClient.triggerSync({
      cookiesB64,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      userId: config.user_id,
      accountId: config.account_id,
      phone: (s.phone_number as string) || '',
      fundCategoryId: (s.fund_category_id as string) || null,
      lastSyncAt: config.last_sync_at || null,
      lastDays,
    });

    // Save refreshed cookies if provided.
    if (result.cookies !== cookiesB64) {
      await supabase
        .from('integration_configs')
        .update({
          settings: { ...s, session_cookies: result.cookies },
          last_sync_at: new Date().toISOString(),
        })
        .eq('id', config.id);
    } else {
      await supabase
        .from('integration_configs')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', config.id);
    }

    return {
      account: config.account_id,
      fetched: result.transactionsCount,
      new_pending: result.imported,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`TR sync failed for ${config.id}:`, error);

    if (msg.includes('auth_required')) {
      const s = (config.settings || {}) as Record<string, unknown>;
      await supabase
        .from('integration_configs')
        .update({ settings: { ...s, auth_status: 'session_expired' } })
        .eq('id', config.id);
    }

    return { account: config.account_id, error: msg };
  }
}

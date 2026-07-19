/**
 * Trade Republic API client — delegates to the Render Python microservice.
 *
 * The Render service wraps pytr, handling WAF challenges via Playwright
 * and writing results directly to Supabase pending_transactions.
 * The Vercel app just triggers the sync and returns immediately.
 *
 * Set TR_SERVICE_URL env var to the Render service URL.
 *
 * @module utils/trade-republic/client
 */

function serviceUrl(): string {
  return process.env.TR_SERVICE_URL || 'http://localhost:5001';
}

async function call(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const resp = await fetch(`${serviceUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000), // 15s timeout for auth calls
  });

  const data = (await resp.json()) as Record<string, unknown>;

  if (data.status === 'error') {
    throw new Error((data.message as string) || 'TR service error');
  }

  if (!resp.ok) {
    throw new Error((data.message as string) || `HTTP ${resp.status}`);
  }

  return data;
}

export class TradeRepublicClient {
  // Auth steps (fast, keep as-is)
  static async initiateDeviceReset(phone: string, pin: string) {
    const data = await call('/auth/initiate', { phone, pin });
    return {
      processId: data.processId as string,
      countdownSeconds: data.countdownSeconds as number,
    };
  }

  static async completeDeviceReset(phone: string, pin: string, processId: string, code: string) {
    const data = await call('/auth/complete', { phone, pin, processId, code });
    return { cookies: data.cookies_b64 as string };
  }

  /**
   * Trigger a sync on the Render service. The Render service handles
   * everything: fetch transactions via pytr, dedup, and write to Supabase.
   * Returns immediately — the UI polls pending_transactions for results.
   */
  static async triggerSync(params: {
    cookiesB64: string;
    supabaseUrl: string;
    supabaseKey: string;
    userId: string;
    accountId: string;
    fundCategoryId?: string | null;
    lastSyncAt?: string | null;
    lastDays?: number;
  }) {
    // Use a longer timeout for sync (Render needs ~60s for pytr).
    const url = `${serviceUrl()}/sync`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cookies_b64: params.cookiesB64,
        supabase_url: params.supabaseUrl,
        supabase_key: params.supabaseKey,
        user_id: params.userId,
        account_id: params.accountId,
        fund_category_id: params.fundCategoryId || null,
        last_sync_at: params.lastSyncAt || null,
        last_days: params.lastDays || 7,
      }),
      signal: AbortSignal.timeout(130000), // 130s — Render has 120s timeout
    });

    const data = (await resp.json()) as Record<string, unknown>;
    if (data.status === 'error') throw new Error((data.message as string) || 'TR sync error');
    if (!resp.ok) throw new Error((data.message as string) || `HTTP ${resp.status}`);

    return {
      transactionsCount: (data.transactions_count as number) || 0,
      imported: (data.imported as number) || 0,
      cookies: (data.cookies_b64 as string) || params.cookiesB64,
    };
  }
}

/**
 * Trade Republic API client — delegates to the Render Python microservice.
 *
 * The Render service wraps pytr, handling WAF challenges via Playwright
 * and the web login flow. This client just calls it via HTTP.
 *
 * Set TR_SERVICE_URL env var to the Render service URL.
 * Falls back to localhost:5000 for development.
 *
 * @module utils/trade-republic/client
 */

import type { TRTransaction } from './types';

function serviceUrl(): string {
  return process.env.TR_SERVICE_URL || 'http://localhost:5001';
}

async function call(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const resp = await fetch(`${serviceUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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
  // -----------------------------------------------------------------------
  // Auth
  // -----------------------------------------------------------------------

  static async initiateDeviceReset(
    phone: string,
    pin: string,
  ): Promise<{ processId: string; countdownSeconds: number }> {
    const data = await call('/auth/initiate', { phone, pin });
    return {
      processId: data.processId as string,
      countdownSeconds: data.countdownSeconds as number,
    };
  }

  static async completeDeviceReset(
    phone: string,
    pin: string,
    processId: string,
    code: string,
  ): Promise<{ cookies: string }> {
    const data = await call('/auth/complete', { phone, pin, processId, code });
    return { cookies: data.cookies_b64 as string };
  }

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  static async getTransactions(
    phone: string,
    pin: string,
    cookiesB64: string,
    fromDate?: Date,
  ): Promise<{ transactions: TRTransaction[]; cookies: string }> {
    const lastDays = fromDate
      ? Math.max(1, Math.ceil((Date.now() - fromDate.getTime()) / 86400000))
      : 7;

    const data = await call('/sync', {
      phone,
      pin,
      cookies_b64: cookiesB64,
      last_days: lastDays,
    });

    const raw = (data.transactions || []) as PytrItem[];
    const transactions = raw.map(mapItem).filter((t): t is TRTransaction => t !== null);

    return {
      transactions,
      cookies: (data.cookies_b64 as string) || cookiesB64,
    };
  }

  // -----------------------------------------------------------------------
  // Stubs for backward compat
  // -----------------------------------------------------------------------

  static async isAuthenticated(): Promise<boolean> {
    return true;
  }

  hasSession(): boolean {
    return true;
  }

  isSessionExpired(): boolean {
    return false;
  }

  serialiseSession(): string {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

interface PytrItem {
  Date?: string;
  Type?: string;
  Value?: number | null;
  Note?: string;
  ISIN?: string | null;
  Shares?: number | null;
}

function mapItem(item: PytrItem): TRTransaction | null {
  const rawValue = item.Value ?? 0;
  if (rawValue == null) return null;
  const amount = Math.abs(rawValue);
  const date = item.Date || '';
  const title = item.Note || 'TR Transaction';
  const typeName = (item.Type || '').toLowerCase();

  let type: TRTransaction['type'];
  if (typeName.includes('buy')) type = 'BUY';
  else if (typeName.includes('sell')) type = 'SELL';
  else if (typeName.includes('dividend')) type = 'DIVIDEND';
  else if (typeName.includes('interest')) type = 'INTEREST';
  else if (typeName.includes('savings') || typeName.includes('plan')) type = 'SAVINGS_PLAN';
  else if (rawValue > 0) type = 'DEPOSIT';
  else type = 'CARD_PAYMENT';

  return {
    id: `${date}_${title}_${rawValue}`,
    amount,
    currency: 'EUR',
    date: new Date(date).toISOString(),
    title,
    type,
    isin: item.ISIN || undefined,
    instrumentName: item.ISIN ? title : undefined,
    shares: item.Shares || undefined,
  };
}

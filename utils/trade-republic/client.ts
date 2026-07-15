/**
 * Trade Republic API client.
 *
 * Delegates all TR communication to scripts/tr-helper.py, which uses pytr's
 * internal classes to handle WAF challenges, auth, and data fetching without
 * interactive prompts.
 *
 * @module utils/trade-republic/client
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import type { TRTransaction } from './types';

const execFileAsync = promisify(execFile);

const PYTHON = 'python3';
const HELPER = join(process.cwd(), 'scripts', 'tr-helper.py');

interface HelperResult {
  status: 'ok' | 'error';
  processId?: string;
  countdownSeconds?: number;
  wafToken?: string;
  cookies?: string;
  transactions?: unknown[];
  message?: string;
}

async function runHelper(args: string[]): Promise<HelperResult> {
  const { stdout } = await execFileAsync(PYTHON, [HELPER, ...args], {
    maxBuffer: 10 * 1024 * 1024,
    timeout: 180_000,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });

  const result = JSON.parse(stdout.trim()) as HelperResult;
  if (result.status === 'error') {
    throw new Error(result.message || 'TR helper error');
  }
  return result;
}

export class TradeRepublicClient {
  // -----------------------------------------------------------------------
  // Auth
  // -----------------------------------------------------------------------

  /**
   * Step 1: send phone + PIN, get back a processId.
   * TR sends a push notification to the user's phone.
   */
  async login(phone: string, pin: string): Promise<{
    processId: string;
    countdownSeconds: number;
    wafToken?: string;
  }> {
    const r = await runHelper(['init', phone, pin]);
    return {
      processId: r.processId!,
      countdownSeconds: r.countdownSeconds!,
      wafToken: r.wafToken,
    };
  }

  /**
   * Step 2: submit the verification code, get session cookies back.
   * Cookies are base64-encoded for storage.
   */
  async verifyLogin(
    phone: string,
    pin: string,
    processId: string,
    code: string,
    wafToken?: string,
  ): Promise<{ cookies: string }> {
    const args = ['complete', phone, pin, processId, code];
    if (wafToken) args.push(wafToken);
    const r = await runHelper(args);
    return { cookies: r.cookies! };
  }

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  /**
   * Fetch transactions using stored session cookies.
   *
   * Returns the transactions and optionally updated cookies (session refresh
   * may modify them).
   */
  async getTransactions(
    phone: string,
    pin: string,
    cookiesB64: string,
    fromDate?: Date,
  ): Promise<{ transactions: TRTransaction[]; cookies?: string }> {
    const days = fromDate
      ? Math.max(1, Math.ceil((Date.now() - fromDate.getTime()) / (1000 * 60 * 60 * 24)))
      : 7;

    const r = await runHelper(['sync', phone, pin, cookiesB64, '--last-days', String(days)]);

    const transactions = ((r.transactions || []) as PytrItem[])
      .map(mapPytrItem)
      .filter((t): t is TRTransaction => t !== null);

    return { transactions, cookies: r.cookies };
  }

  // -----------------------------------------------------------------------
  // Session check
  // -----------------------------------------------------------------------

  async isAuthenticated(_cookies?: string): Promise<boolean> {
    return true; // We check auth at sync time via the helper.
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
// pytr JSON helpers
// ---------------------------------------------------------------------------

interface PytrItem {
  Date?: string;
  Type?: string;
  Value?: number | null;
  Note?: string;
  ISIN?: string | null;
  Shares?: number | null;
  Fees?: number | null;
  Taxes?: number | null;
}

function mapPytrItem(item: PytrItem): TRTransaction | null {
  if (!item.Date && !item.Note) return null;
  const rawValue = item.Value ?? 0;
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

/**
 * Trade Republic API client.
 *
 * Thin wrapper that delegates to the pytr Python CLI for all Trade Republic
 * communication. TR uses AWS WAF protection that requires executing a
 * JavaScript challenge in a real browser — pytr handles this via Playwright.
 *
 * On macOS, install pytr with:
 *   pip3 install pytr
 *   python3 -m playwright install chromium
 *
 * Then authenticate once:
 *   pytr login
 *
 * @module utils/trade-republic/client
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, unlink, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { TRTransaction } from './types';

const execFileAsync = promisify(execFile);

/**
 * Run a pytr command and return its stdout as a string.
 * Throws if the command fails.
 */
async function pytr(args: string[]): Promise<string> {
  const { stdout, stderr } = await execFileAsync('pytr', args, {
    maxBuffer: 10 * 1024 * 1024, // 10 MB
    timeout: 120_000,            // 2 minutes
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });

  if (stderr) {
    console.warn('pytr stderr:', stderr);
  }

  return stdout;
}

export class TradeRepublicClient {
  private phoneNumber: string | null;

  constructor(_cookies?: string) {
    this.phoneNumber = null;
  }

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  /**
   * Check if pytr has valid stored credentials by verifying that the
   * credentials file and a cookies file exist in ~/.pytr.
   *
   * Also tries a quick `export_transactions --last_days 1` to confirm
   * the session is still valid.
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      // Check if credentials file exists.
      const { stat } = await import('node:fs/promises');
      const { homedir } = await import('node:os');
      const home = homedir();
      const { join } = await import('node:path');

      const credFile = join(home, '.pytr', 'credentials');
      await stat(credFile);

      // Also verify a quick export works (confirms session is valid).
      const tmpDir = await mkdtemp(join(tmpdir(), 'pytr-auth-'));
      const outPath = join(tmpDir, 'test.json');
      try {
        await pytr([
          'export_transactions',
          '--export-format', 'json',
          '--last_days', '1',
          outPath,
        ]);
        return true;
      } catch {
        return false;
      } finally {
        try { await unlink(outPath); } catch {}
        try { const { rmdir } = await import('node:fs/promises'); await rmdir(tmpDir); } catch {}
      }
    } catch {
      return false;
    }
  }

  /**
   * Initiate login. Since pytr handles login interactively (phone + PIN + 2FA),
   * this just calls `pytr login`. The user must have already run `pytr login`
   * in their terminal before using this integration.
   */
  async login(phoneNumber: string, pin: string): Promise<{
    processId: string;
    countdownSeconds: number;
  }> {
    this.phoneNumber = phoneNumber;

    const stdout = await pytr(['login', '--phone', phoneNumber, '--pin', pin]);

    console.log('pytr login stdout:', stdout);

    return {
      processId: 'pytr-managed',
      countdownSeconds: 0,
    };
  }

  /**
   * pytr handles the 2FA flow internally during `pytr login`.
   * Not needed in this client.
   */
  async verifyLogin(): Promise<{ cookies: string; expiresAt: string }> {
    throw new Error(
      'Trade Republic: 2FA is handled by pytr CLI. Run `pytr login` in your terminal.',
    );
  }

  // -------------------------------------------------------------------------
  // Session
  // -------------------------------------------------------------------------

  hasSession(): boolean {
    return true;
  }

  isSessionExpired(): boolean {
    return false; // pytr refreshes automatically
  }

  serialiseSession(): string {
    return JSON.stringify({ provider: 'pytr', phoneNumber: this.phoneNumber });
  }

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  /**
   * Fetch transactions via pytr export_transactions command.
   *
   * pytr writes to a file by default. We create a temp file, run the export
   * in JSON format, read the file, and parse it.
   */
  async getTransactions(fromDate?: Date): Promise<TRTransaction[]> {
    // Create a temp directory for the output.
    const tmpDir = await mkdtemp(join(tmpdir(), 'pytr-'));
    const outputPath = join(tmpDir, 'transactions.json');

    try {
      const args = [
        'export_transactions',
        '--export-format', 'json',
        '--no-date-with-time',
        outputPath,
      ];

      // If we have a fromDate, limit to recent transactions.
      // pytr uses --last_days to limit the range. If fromDate is provided,
      // compute how many days back it is.
      if (fromDate) {
        const daysAgo = Math.max(
          1,
          Math.ceil((Date.now() - fromDate.getTime()) / (1000 * 60 * 60 * 24)),
        );
        args.push('--last_days', String(daysAgo));
      } else {
        args.push('--last_days', '0'); // all time
      }

      await pytr(args);

      // Read the JSON output file.
      let raw: string;
      try {
        const { readFile } = await import('node:fs/promises');
        raw = await readFile(outputPath, 'utf-8');
      } catch {
        console.warn('pytr: no output file at', outputPath);
        return [];
      }

      // pytr outputs newline-delimited JSON (one object per line).
      const lines = raw
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const transactions: PytrTransaction[] = [];
      for (const line of lines) {
        try {
          transactions.push(JSON.parse(line));
        } catch {
          console.warn('pytr: skipping invalid JSON line:', line.substring(0, 80));
        }
      }

      if (transactions.length === 0) {
        console.warn('pytr: no valid JSON transactions found');
        return [];
      }

      return transactions
        .map(mapPytrTransaction)
        .filter((t): t is TRTransaction => t !== null);
    } finally {
      // Clean up temp directory.
      try {
        await unlink(outputPath);
        const { rmdir } = await import('node:fs/promises');
        await rmdir(tmpDir);
      } catch {
        // Best effort cleanup.
      }
    }
  }
}

// ---------------------------------------------------------------------------
// pytr transaction types — based on actual pytr export_transactions JSON output
// ---------------------------------------------------------------------------

/**
 * Real pytr JSON output format (tested with pytr 0.4.9):
 * {
 *   "Date": "2026-07-13T17:56:55",
 *   "Type": "Removal" | "Addition" | "Buy" | "Sell" | "Dividend" | "Interest" | "Savings plan",
 *   "Value": -15.0,
 *   "Note": "Card Payment - LA TIENDA DE BARRIO",
 *   "ISIN": null,
 *   "Shares": null,
 *   "Fees": null,
 *   "Taxes": null,
 *   "ISIN2": null,
 *   "Shares2": null
 * }
 */
interface PytrTransaction {
  Date: string;
  Type: string;
  Value: number;
  Note: string;
  ISIN: string | null;
  Shares: number | null;
  Fees: number | null;
  Taxes: number | null;
  ISIN2: string | null;
  Shares2: number | null;
}

function mapPytrTransaction(item: PytrTransaction): TRTransaction | null {
  if (!item.Date || !item.Note) return null;

  const rawValue = item.Value;
  const amount = Math.abs(rawValue);
  const currency = 'EUR'; // TR accounts are always in EUR
  const date = item.Date;

  // pytr Type mapping to our internal types.
  const typeName = (item.Type || '').toLowerCase();
  let type: TRTransaction['type'];
  let title = item.Note;

  if (typeName.includes('card') || typeName.includes('removal')) {
    type = rawValue < 0 ? 'CARD_PAYMENT' : 'DEPOSIT';
  } else if (typeName.includes('addition') || typeName.includes('deposit')) {
    type = 'DEPOSIT';
  } else if (typeName.includes('buy') || typeName.includes('order')) {
    type = 'BUY';
  } else if (typeName.includes('sell')) {
    type = 'SELL';
  } else if (typeName.includes('dividend')) {
    type = 'DIVIDEND';
  } else if (typeName.includes('interest') || typeName.includes('zinsen')) {
    type = 'INTEREST';
  } else if (typeName.includes('savings') || typeName.includes('plan')) {
    type = 'SAVINGS_PLAN';
  } else if (typeName.includes('fee') || typeName.includes('gebühr')) {
    type = 'FEE';
  } else if (rawValue > 0) {
    type = 'DEPOSIT';
  } else {
    type = 'CARD_PAYMENT';
  }

  // Generate a stable ID from date + note + value.
  const id = `${item.Date}_${item.Note}_${item.Value}`;

  return {
    id,
    amount,
    currency,
    date: new Date(date).toISOString(),
    title,
    type,
    isin: item.ISIN || item.ISIN2 || undefined,
    instrumentName: item.ISIN ? item.Note : undefined,
    shares: item.Shares || item.Shares2 || undefined,
  };
}

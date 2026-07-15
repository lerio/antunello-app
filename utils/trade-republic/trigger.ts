/**
 * Trade Republic sync trigger utility.
 *
 * On Vercel (where pytr cannot run), the sync routes trigger a GitHub Actions
 * workflow instead of spawning pytr directly. The workflow runs pytr on a
 * GitHub-hosted VM and imports transactions into Supabase.
 *
 * On local dev, pytr is spawned directly via the client.
 *
 * @module utils/trade-republic/trigger
 */

import { syncTradeRepublicAccount } from './sync-service';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Result shape returned by both local and Vercel sync paths. */
export interface TRSyncResult {
  account: string;
  fetched?: number;
  new_pending?: number;
  error?: string;
  triggered?: boolean; // true when a GitHub workflow was dispatched
}

/**
 * Minimal integration config shape.
 */
export interface TRConfig {
  id: string;
  user_id: string;
  provider: string;
  account_id: string;
  last_sync_at?: string | null;
  settings?: Record<string, unknown> | null;
}

const GITHUB_REPO = 'lerio/antunello-app';
const WORKFLOW_FILENAME = 'tr-sync.yml';

/**
 * Trigger the Trade Republic sync GitHub Actions workflow via the GitHub API.
 */
async function triggerGitHubWorkflow(): Promise<TRSyncResult> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return { account: 'trade_republic', error: 'Missing GITHUB_TOKEN env var' };
  }

  const url = `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILENAME}/dispatches`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json',
    },
    body: JSON.stringify({
      ref: 'main',
      inputs: { last_days: '7' },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return { account: 'trade_republic', error: `GitHub API error (${response.status}): ${text}` };
  }

  return {
    account: 'trade_republic',
    triggered: true,
    fetched: 0,
    new_pending: 0,
  };
}

/**
 * Sync Trade Republic transactions, dispatching to the appropriate method
 * based on the runtime environment.
 *
 * - **Vercel**: Triggers a GitHub Actions workflow that runs pytr.
 * - **Local**: Spawns pytr directly via child_process.
 *
 * @param supabase - A Supabase client (admin or user-authenticated).
 * @param config - The TR integration config row.
 */
export async function triggerTRSync(
  supabase: SupabaseClient,
  config: TRConfig,
): Promise<TRSyncResult> {
  const isVercel = !!process.env.VERCEL;

  if (isVercel) {
    return triggerGitHubWorkflow();
  }

  // Local: run pytr directly.
  return syncTradeRepublicAccount(supabase, config);
}

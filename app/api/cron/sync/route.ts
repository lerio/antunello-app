/**
 * @file Cron / manual-trigger endpoint for synchronising bank transactions
 * from the Enable Banking API into the application's `pending_transactions`
 * table. Supports optional `account_id` filtering and authentication via
 * either a `CRON_SECRET` bearer token or a regular user session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { EnableBankingClient } from '@/utils/enable-banking/client';
import { syncAccount } from '@/utils/enable-banking/sync-service';
import { syncTradeRepublicAccount } from '@/utils/trade-republic/sync-service';

export const maxDuration = 60; // Vercel Hobby max

/**
 * Synchronise bank transactions from Enable Banking for one or more
 * integration configs. Accepts an optional `account_id` query parameter to
 * target a specific account.
 *
 * @param request - The incoming request. May contain:
 *   - `Authorization: Bearer <CRON_SECRET>` for cron-job auth,
 *   - or a Supabase user session, as either a session cookie (browser) or a
 *     bearer access token (native client).
 *   - `?account_id=...` to filter a single account.
 * @returns A JSON response with per-account sync results.
 */
export async function GET(request: NextRequest) {
    let internalUserId: string | null = null;

    // 1. Authenticate Request
    const authHeader = request.headers.get('authorization');
    const bearer = authHeader?.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length).trim()
        : null;

    if (bearer !== null && bearer === process.env.CRON_SECRET) {
        // Cron job. No user filter — it syncs every account.
    } else {
        // Not a cron job, so it has to be a user: either a browser sending its
        // session cookie, or a native client sending its access token in the
        // Authorization header (which cannot hold the cron secret).
        //
        // A bearer token is verified against the auth server rather than decoded.
        // Reading a JWT proves nothing about it — the signature is the only part
        // that matters, and only the auth server can check it.
        const { createClient } = await import('@/utils/supabase/server');
        const supabase = await createClient();
        const { data: { user } } = await (bearer
            ? supabase.auth.getUser(bearer)
            : supabase.auth.getUser());

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        internalUserId = user.id;
    }

    const supabase = createAdminClient();

    // Extract optional account_id filter from query params
    const accountId = request.nextUrl.searchParams.get('account_id');

    // 2. Fetch integration configs
    let configQuery = supabase
        .from('integration_configs')
        .select('id, user_id, provider, account_id, last_sync_at, settings');

    // Always filter by user_id if authenticated via session
    if (internalUserId) {
        configQuery = configQuery.eq('user_id', internalUserId);
    }

    if (accountId) {
        configQuery = configQuery.eq('account_id', accountId);
    }

    const { data: configs, error: configError } = await configQuery;

    if (configError) {
        return NextResponse.json({ error: configError.message }, { status: 500 });
    }

    if (!configs || configs.length === 0) {
        const message = accountId
            ? `No integration config found for account_id: ${accountId}`
            : 'No integration configs found';
        return NextResponse.json({ message });
    }

    // 3. Delegate per-account sync to the appropriate provider-specific service.
    const results = await Promise.all(
        configs.map(async (config) => {
            if (config.provider === 'trade_republic') {
                return syncTradeRepublicAccount(supabase, config);
            }

            // Default / enable_banking path.
            const appId = process.env.ENABLE_BANKING_APP_ID;
            const appKey = process.env.ENABLE_BANKING_PRIVATE_KEY;
            const kid = process.env.ENABLE_BANKING_KID || appId;

            if (!appId || !appKey) {
                return { account: config.account_id, error: 'Missing Server-side Enable Banking Configuration' };
            }

            const client = new EnableBankingClient({ appId, appKey, kid: kid! });
            return syncAccount(supabase, config, client);
        })
    );

    return NextResponse.json({ results });
}

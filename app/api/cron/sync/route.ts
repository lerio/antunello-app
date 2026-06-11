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

/**
 * Synchronise bank transactions from Enable Banking for one or more
 * integration configs. Accepts an optional `account_id` query parameter to
 * target a specific account.
 *
 * @param request - The incoming request. May contain:
 *   - `Authorization: Bearer <CRON_SECRET>` for cron-job auth, or
 *   - a valid Supabase user session cookie.
 *   - `?account_id=...` to filter a single account.
 * @returns A JSON response with per-account sync results.
 */
export async function GET(request: NextRequest) {
    let internalUserId: string | null = null;

    // 1. Authenticate Request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // Not a cron job, check for user session
        const { createClient } = await import('@/utils/supabase/server');
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

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
        .select('id, user_id, account_id, last_sync_at, settings');

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

    const appId = process.env.ENABLE_BANKING_APP_ID;
    const appKey = process.env.ENABLE_BANKING_PRIVATE_KEY;
    const kid = process.env.ENABLE_BANKING_KID || appId;

    if (!appId || !appKey) {
        return NextResponse.json({ error: 'Missing Server-side Enable Banking Configuration' }, { status: 500 });
    }

    const client = new EnableBankingClient({ appId, appKey, kid: kid! });

    // 3. Delegate per-account sync to the shared sync service
    const results = await Promise.all(
        configs.map(config => syncAccount(supabase, config, client))
    );

    return NextResponse.json({ results });
}

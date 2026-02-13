import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getErrorMessage, jsonError, requireUserId } from '@/app/api/_lib/route-utils';

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { userId, unauthorizedResponse } = await requireUserId(supabase);
        if (!userId) {
            return unauthorizedResponse!;
        }

        // 1. Get all integration configs for the user
        const { data: configs, error: fetchError } = await supabase
            .from('integration_configs')
            .select('id, user_id, account_id, last_sync_at, settings')
            .eq('user_id', userId);

        if (fetchError) {
            throw fetchError;
        }

        if (!configs || configs.length === 0) {
            return NextResponse.json({ message: 'No accounts connected', results: [] });
        }

        // 2. Filter for accounts with bulk_fetch_enabled
        const enabledConfigs = configs.filter(config => {
            const settings = config.settings as any || {};
            // Default to FALSE if not set? Or TRUE? User said "enable bulk fetch switch", implying it's off by default or opt-in.
            // Let's assume false by default if undefined, or check the switch logic.
            return !!settings.bulk_fetch_enabled;
        });

        if (enabledConfigs.length === 0) {
            return NextResponse.json({ message: 'No accounts enabled for bulk fetch', results: [] });
        }

        // 3. Trigger sync for each enabled account
        const appId = process.env.ENABLE_BANKING_APP_ID;
        const appKey = process.env.ENABLE_BANKING_PRIVATE_KEY;
        const kid = process.env.ENABLE_BANKING_KID || appId;

        if (!appId || !appKey) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const { EnableBankingClient } = await import('@/utils/enable-banking/client');
        const { syncAccount } = await import('@/utils/enable-banking/sync-service');
        const client = new EnableBankingClient({ appId, appKey, kid: kid! });

        // Run syncs in parallel
        const results = await Promise.all(enabledConfigs.map(config => syncAccount(supabase, config, client)));

        return NextResponse.json({
            message: `Bulk fetch completed`,
            results
        });

    } catch (error: any) {
        console.error('Bulk fetch error:', error);
        return jsonError(getErrorMessage(error), 500);
    }
}

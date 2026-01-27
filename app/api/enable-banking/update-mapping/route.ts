import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { account_id, fund_category_id, bulk_fetch_enabled } = await request.json();

        if (!account_id) {
            return NextResponse.json({ error: 'Missing account_id' }, { status: 400 });
        }

        // 1. Get existing config
        const { data: config, error: fetchError } = await supabase
            .from('integration_configs')
            .select('*')
            .eq('user_id', user.id)
            .eq('account_id', account_id)
            .single();

        if (fetchError || !config) {
            return NextResponse.json({ error: 'Integration config not found' }, { status: 404 });
        }

        // 2. Update settings
        const currentSettings = (config.settings as any) || {};
        const updatedSettings = {
            ...currentSettings,
            // Only update fields if they are provided in the request
            // This allows partial updates (only toggling bulk fetch OR changing mapping)
            ...(fund_category_id !== undefined ? { fund_category_id: fund_category_id || null } : {}),
            ...(bulk_fetch_enabled !== undefined ? { bulk_fetch_enabled } : {})
        };

        const { error: updateError } = await supabase
            .from('integration_configs')
            .update({
                settings: updatedSettings,
                updated_at: new Date().toISOString()
            })
            .eq('id', config.id);

        if (updateError) {
            throw updateError;
        }

        return NextResponse.json({ success: true, settings: updatedSettings });

    } catch (error: any) {
        console.error('Update mapping error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

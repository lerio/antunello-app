import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getErrorMessage, jsonError, requireUserId } from '@/app/api/_lib/route-utils';

export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { userId, unauthorizedResponse } = await requireUserId(supabase);
        if (!userId) {
            return unauthorizedResponse!;
        }

        const { bank_name, account_id } = await request.json();

        if (!bank_name && !account_id) {
            return NextResponse.json({ error: 'Must provide bank_name or account_id' }, { status: 400 });
        }

        let query = supabase.from('integration_configs').delete().eq('user_id', userId);

        if (account_id) {
            query = query.eq('account_id', account_id);
        } else if (bank_name) {
            // We stored bank_name in the 'settings' jsonb column.
            // Postgres JSONB query: settings->>'bank_name' = value
            query = query.eq('settings->>bank_name', bank_name);
        }

        const { error } = await query;

        if (error) {
            throw error;
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        return jsonError(getErrorMessage(error), 500);
    }
}

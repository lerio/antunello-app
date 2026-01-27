import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { bank_name, account_id } = await request.json();

        if (!bank_name && !account_id) {
            return NextResponse.json({ error: 'Must provide bank_name or account_id' }, { status: 400 });
        }

        let query = supabase.from('integration_configs').delete().eq('user_id', user.id);

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
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

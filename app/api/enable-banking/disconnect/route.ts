import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getErrorMessage, jsonError, requireUserId } from '@/app/api/_lib/route-utils';

function normalizeBankName(value: unknown) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

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

        let matchingIds: string[] = [];

        if (account_id) {
            const { data: configs, error } = await supabase
                .from('integration_configs')
                .select('id')
                .eq('user_id', userId)
                .eq('account_id', account_id);

            if (error) {
                throw error;
            }

            matchingIds = configs?.map((config) => config.id) ?? [];
        } else if (bank_name) {
            const { data: configs, error } = await supabase
                .from('integration_configs')
                .select('id, provider, settings')
                .eq('user_id', userId);

            if (error) {
                throw error;
            }

            const requestedBank = normalizeBankName(bank_name);
            matchingIds = (configs ?? [])
                .filter((config) => {
                    const settings = (config.settings as any) || {};
                    const storedBank = normalizeBankName(settings.bank_name);

                    if (storedBank) {
                        return storedBank === requestedBank || storedBank.includes(requestedBank);
                    }

                    return requestedBank === 'bunq' && config.provider === 'enable_banking';
                })
                .map((config) => config.id);
        }

        if (matchingIds.length === 0) {
            return NextResponse.json({ error: 'Integration config not found' }, { status: 404 });
        }

        const { data: deletedConfigs, error } = await supabase
            .from('integration_configs')
            .delete()
            .in('id', matchingIds)
            .select('id');

        if (error) {
            throw error;
        }

        if (!deletedConfigs || deletedConfigs.length === 0) {
            return NextResponse.json({ error: 'No integration configs were deleted' }, { status: 404 });
        }

        return NextResponse.json({ success: true, deleted: deletedConfigs.length });

    } catch (error: any) {
        return jsonError(getErrorMessage(error), 500);
    }
}

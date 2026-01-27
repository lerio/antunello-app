import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { EnableBankingClient } from '@/utils/enable-banking/client';
import { Transaction } from '@/types/database';

// Helper to format date as YYYY-MM-DD
const toISODate = (dateStr: string) => {
    return new Date(dateStr).toISOString().split('T')[0];
};

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
        .select('*');

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
    const results = [];

    for (const config of configs) {
        try {
            // 3. Fetch Transactions from Enable Banking
            const lastSync = config.last_sync_at ? new Date(config.last_sync_at) : undefined;
            // If never synced, maybe fetch last 30 days? Or just skip? 
            // Let's default to last 7 days if not set, to avoid flooding.
            const fetchFrom = lastSync || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            const fetchedTransactions = await client.getAccountTransactions(config.account_id, fetchFrom);

            if (fetchedTransactions.length === 0) {
                results.push({ account: config.account_id, status: 'no_new_transactions' });
                continue;
            }

            // 4. Deduplicate
            // 4a. Fetch existing DB transactions for this user in the relevant date range
            // We buffer the date range slightly
            const fromDateStr = toISODate(fetchFrom.toISOString());

            const { data: existingTransactions } = await supabase
                .from('transactions')
                .select('amount, date, currency')
                .eq('user_id', config.user_id)
                .gte('date', fromDateStr);

            const { data: existingPending } = await supabase
                .from('pending_transactions')
                .select('external_id')
                .eq('user_id', config.user_id);

            const existingTxSignature = new Set(
                existingTransactions?.map(t => `${parseFloat(t.amount.toString()).toFixed(2)}_${toISODate(t.date)}_${t.currency}`)
            );

            const existingPendingIds = new Set(existingPending?.map(p => p.external_id));

            const newPendingTransactions = [];

            for (const tx of fetchedTransactions) {
                if (existingPendingIds.has(tx.transaction_id || tx.entry_reference)) continue;

                // Handle both possible field names for amount
                const amountObj = tx.transaction_amount || tx.amount;

                // Defensive check/logging for missing amount
                if (!amountObj || !amountObj.amount) {
                    console.warn(`Transaction ${tx.transaction_id || tx.entry_reference} is missing amount data. Skipping.`, JSON.stringify(tx));
                    continue;
                }

                const amount = parseFloat(amountObj.amount);
                const date = tx.booking_date; // Assuming YYYY-MM-DD
                const currency = amountObj.currency;

                // Handle remittance information - prioritize creditor name
                let title = 'Bank Transaction';
                if (tx.creditor?.name) {
                    title = tx.creditor.name;
                } else if (Array.isArray(tx.remittance_information) && tx.remittance_information.length > 0) {
                    title = tx.remittance_information[0].trim();
                } else if (tx.remittance_information_unstructured) {
                    title = tx.remittance_information_unstructured;
                } else if (tx.remittance_information_structured) {
                    title = tx.remittance_information_structured;
                }

                // Construct signature for matching against manual entries
                // Enable Banking returns negative for debits (expenses)
                let txAmount = Math.abs(amount);
                const signature = `${txAmount.toFixed(2)}_${date}_${currency}`;

                if (!existingTxSignature.has(signature)) {
                    // Determine transaction type from credit_debit_indicator
                    // DBIT = Debit (expense), CRDT = Credit (income)
                    const txType = (tx as any).credit_debit_indicator === 'CRDT' ? 'income' : 'expense';

                    // Extract IBAN from debtor_account (for expenses) or creditor_account (for income)
                    const accountIban = txType === 'expense'
                        ? ((tx as any).debtor_account?.iban || null)
                        : ((tx as any).creditor_account?.iban || null);

                    // Use the saved fund_category_id mapping from integration config settings
                    const fundCategoryId = (config.settings as any).fund_category_id || null;

                    // Use the most precise timestamp available
                    // Try to get full ISO timestamp with time, fallback to date-only
                    let transactionTimestamp: string;
                    const rawDate = (tx as any).value_date || (tx as any).transaction_date || date;

                    // Check if we have a timestamp (contains 'T') or just a date
                    if (rawDate.includes('T')) {
                        transactionTimestamp = rawDate; // Already has time
                    } else {
                        // Date only - convert to ISO timestamp (use current time as approximation)
                        // Better would be to use transaction_time if available
                        const timeStr = (tx as any).transaction_time || '12:00:00';
                        transactionTimestamp = new Date(`${rawDate}T${timeStr}`).toISOString();
                    }

                    newPendingTransactions.push({
                        user_id: config.user_id,
                        external_id: tx.transaction_id || tx.entry_reference,
                        data: {
                            amount: txAmount,
                            currency: currency,
                            date: transactionTimestamp,
                            title: title,
                            type: txType,
                            account_iban: accountIban,
                            fund_category_id: fundCategoryId,
                            original_amount: amount // Keep original signed amount to infer type
                        },
                        status: 'pending'
                    });
                }
            }

            // 5. Insert into pending_transactions
            if (newPendingTransactions.length > 0) {
                const { error: insertError } = await supabase
                    .from('pending_transactions')
                    .insert(newPendingTransactions);

                if (insertError) throw insertError;
            }

            // 6. Update last_sync_at
            await supabase
                .from('integration_configs')
                .update({ last_sync_at: new Date().toISOString() })
                .eq('id', config.id);

            results.push({
                account: config.account_id,
                fetched: fetchedTransactions.length,
                new_pending: newPendingTransactions.length
            });

        } catch (error: any) {
            console.error(`Sync failed for config ${config.id}:`, error);
            results.push({ account: config.account_id, error: error.message });
        }
    }

    return NextResponse.json({ results });
}

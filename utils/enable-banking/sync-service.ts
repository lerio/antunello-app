import { SupabaseClient } from '@supabase/supabase-js';
import { EnableBankingClient } from './client';

// Helper to format date as YYYY-MM-DD
const toISODate = (dateStr: string) => {
    return new Date(dateStr).toISOString().split('T')[0];
};

export async function syncAccount(
    supabase: SupabaseClient,
    config: any,
    client: EnableBankingClient
) {
    try {
        // 1. Determine fetch date
        const lastSync = config.last_sync_at ? new Date(config.last_sync_at) : undefined;
        // Default to last 7 days if not set or very old, to avoid flooding
        const fetchFrom = lastSync || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // 2. Fetch from Enable Banking
        const fetchedTransactions = await client.getAccountTransactions(config.account_id, fetchFrom);

        if (fetchedTransactions.length === 0) {
            return { account: config.account_id, status: 'no_new_transactions' };
        }

        // 3. Deduplicate
        // 3a. Fetch existing DB transactions for this user in the relevant date range
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

            const amountObj = tx.transaction_amount || tx.amount;
            if (!amountObj || !amountObj.amount) {
                console.warn(`Transaction ${tx.transaction_id || tx.entry_reference} is missing amount data. Skipping.`, JSON.stringify(tx));
                continue;
            }

            const amount = parseFloat(amountObj.amount);
            const date = tx.booking_date;
            const currency = amountObj.currency;

            // Handle remittance information
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

            let txAmount = Math.abs(amount);
            const signature = `${txAmount.toFixed(2)}_${date}_${currency}`;

            if (!existingTxSignature.has(signature)) {
                // Determine transaction type from credit_debit_indicator
                const txType = (tx as any).credit_debit_indicator === 'CRDT' ? 'income' : 'expense';

                const accountIban = txType === 'expense'
                    ? ((tx as any).debtor_account?.iban || null)
                    : ((tx as any).creditor_account?.iban || null);

                const fundCategoryId = (config.settings as any).fund_category_id || null;

                let transactionTimestamp: string;
                const rawDate = (tx as any).value_date || (tx as any).transaction_date || date;

                if (rawDate.includes('T')) {
                    transactionTimestamp = rawDate;
                } else {
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
                        original_amount: amount
                    },
                    status: 'pending'
                });
            }
        }

        // 4. Insert into pending_transactions
        if (newPendingTransactions.length > 0) {
            const { error: insertError } = await supabase
                .from('pending_transactions')
                .insert(newPendingTransactions);

            if (insertError) throw insertError;
        }

        // 5. Update last_sync_at
        await supabase
            .from('integration_configs')
            .update({ last_sync_at: new Date().toISOString() })
            .eq('id', config.id);

        return {
            account: config.account_id,
            fetched: fetchedTransactions.length,
            new_pending: newPendingTransactions.length
        };

    } catch (error: any) {
        console.error(`Sync failed for config ${config.id}:`, error);
        return { account: config.account_id, error: error.message };
    }
}

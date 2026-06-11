/**
 * Enable Banking sync service for importing bank transactions.
 *
 * Provides the main sync function that fetches bank transactions from the
 * Enable Banking API, deduplicates them against existing transactions in the
 * local database, and stores new ones as pending transactions for user review
 * and approval.
 *
 * @module utils/enable-banking/sync-service
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { EnableBankingClient, IntegrationConfig } from './client';

/**
 * Converts a date string to ISO YYYY-MM-DD format.
 *
 * @param dateStr - Any date-parsable string
 * @returns The date in YYYY-MM-DD format
 */
const toISODate = (dateStr: string) => {
    return new Date(dateStr).toISOString().split('T')[0];
};

/**
 * Synchronises bank transactions from a configured Enable Banking account
 * into the application's pending_transactions table.
 *
 * The function:
 * 1. Determines the fetch start date (last sync timestamp, or last 7 days)
 * 2. Fetches transactions from the Enable Banking API
 * 3. Deduplicates against existing transactions (by amount+date+currency signature)
 *    and existing pending transactions (by external_id)
 * 4. Inserts new, unique transactions as pending entries
 * 5. Updates the integration config's last_sync_at timestamp
 *
 * @param supabase - A Supabase client instance for database operations
 * @param config - The integration configuration object (must include
 *                 account_id, user_id, last_sync_at, id, and settings)
 * @param client - An initialised EnableBankingClient for API calls
 * @returns A result object with account, fetched count, new pending count,
 *          and optionally an error message on failure
 */
export async function syncAccount(
    supabase: SupabaseClient,
    config: IntegrationConfig,
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
                const txType = tx.credit_debit_indicator === 'CRDT' ? 'income' : 'expense';

                const accountIban = txType === 'expense'
                    ? (tx.debtor_account?.iban || null)
                    : (tx.creditor_account?.iban || null);

                const fundCategoryId = config.settings?.fund_category_id || null;

                let transactionTimestamp: string;
                const rawDate = tx.value_date || tx.transaction_date || date;

                if (rawDate.includes('T')) {
                    transactionTimestamp = rawDate;
                } else {
                    const timeStr = tx.transaction_time || '12:00:00';
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

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Sync failed for config ${config.id}:`, error);
        return { account: config.account_id, error: message };
    }
}

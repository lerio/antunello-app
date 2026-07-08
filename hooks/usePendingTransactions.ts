import useSWR from 'swr';
import { createClient } from '@/utils/supabase/client';

/**
 * Represents a pending transaction stored in the database.
 * Pending transactions are imported from external sources (e.g., banking feeds)
 * and await user action to be confirmed, dismissed, or categorized.
 */
export type PendingTransaction = {
    /** Unique identifier */
    id: string;
    /** Owner user ID */
    user_id: string;
    /** Current lifecycle status */
    status: 'pending' | 'added' | 'dismissed';
    /** External identifier from the source system */
    external_id: string;
    /** ISO timestamp of creation */
    created_at: string;
    /** ISO timestamp of last update */
    updated_at: string;
    /** Parsed transaction data that the user will review */
    data: {
        amount: number;
        currency: string;
        type: 'expense' | 'income';
        main_category?: string;
        sub_category?: string;
        title: string;
        date: string;
        account_iban?: string;
        fund_category_id?: string | null;
        original_amount?: number;
        /** Bank's booking date (YYYY-MM-DD) — when the bank posted it */
        booking_date?: string | null;
        /** Bank's value date (YYYY-MM-DD) — when the money actually moved */
        value_date?: string | null;
        /** Bank's transaction date (YYYY-MM-DD) — when initiated */
        transaction_date?: string | null;
    };
    /** Raw payload as received from the external source */
    raw_data?: any;
};

/**
 * Hook to fetch pending transactions from the database using SWR.
 *
 * Queries the `pending_transactions` table for all records with `status = 'pending'`
 * belonging to the current authenticated user. Refetches every 60 seconds
 * and on window focus.
 *
 * @returns SWR response with the list of `PendingTransaction` objects
 */
export function usePendingTransactions() {
    const fetcher = async () => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('pending_transactions')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching pending transactions:", error);
            throw error;
        }
        return data as PendingTransaction[] || [];
    };

    return useSWR('pending-transactions', fetcher, {
        refreshInterval: 60000,
        revalidateOnFocus: true
    });
}

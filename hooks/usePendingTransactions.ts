import useSWR from 'swr';
import { createClient } from '@/utils/supabase/client';

export type PendingTransaction = {
    id: string;
    user_id: string;
    status: 'pending' | 'added' | 'dismissed';
    external_id: string;
    created_at: string;
    updated_at: string;
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
    };
    raw_data?: any;
};

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

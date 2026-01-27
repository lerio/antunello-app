"use client";

import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import useSWR from "swr";

export function PendingTransactionsNotifier() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const { data: pendingTransactions } = useSWR('pending-transactions', async () => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('pending_transactions')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching pending transactions:", error);
            return [];
        }
        return data || [];
    }, {
        refreshInterval: 60000, // Check every minute
        revalidateOnFocus: true
    });

    if (!mounted || !pendingTransactions || pendingTransactions.length === 0) {
        return null;
    }

    const count = pendingTransactions.length;
    const first = pendingTransactions[0];

    // Construct URL for the first transaction to review
    const params = new URLSearchParams();
    if (first.data) {
        const txData = first.data as any;
        if (txData.amount) params.set('amount', Math.abs(txData.amount).toString());
        if (txData.title) params.set('title', txData.title);
        if (txData.date) params.set('date', txData.date);
        if (txData.currency) params.set('currency', txData.currency);
        // Infer type if amount is negative? Usually API returns signed.
        // If we stored original_amount:
        if (txData.original_amount) {
            params.set('type', parseFloat(txData.original_amount) < 0 ? 'expense' : 'income');
        } else {
            // Default logic fallback
            params.set('type', 'expense');
        }
    }
    params.set('pending_id', first.id);
    params.set('external_id', first.external_id);

    const url = `/protected/add?${params.toString()}`;

    return (
        <div className="fixed bottom-24 right-4 z-40 animate-in slide-in-from-bottom-5 duration-300">
            <Link
                href={url}
                className="flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-full shadow-lg transition-colors border-2 border-white dark:border-gray-800"
            >
                <div className="relative">
                    <Bell size={20} />
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold h-4 w-4 flex items-center justify-center rounded-full">
                        {count}
                    </span>
                </div>
                <span className="font-medium text-sm pr-1">
                    {count === 1 ? 'New Transaction Found' : `${count} New Transactions`}
                </span>
            </Link>
        </div>
    );
}

"use client";

import { create } from 'zustand';

interface PendingTransaction {
    id: string;
    external_id: string;
    data: {
        amount: number;
        currency: string;
        date: string;
        title: string;
        type?: 'expense' | 'income';
        account_iban?: string;
        fund_category_id?: string | null;
        original_amount?: number;
    };
}

interface PendingTransactionModalState {
    isOpen: boolean;
    pendingTransactions: PendingTransaction[];
    currentIndex: number;
    openModal: (transactions: PendingTransaction[]) => void;
    closeModal: () => void;
    nextTransaction: () => void;
    currentTransaction: () => PendingTransaction | null;
}

export const usePendingTransactionModal = create<PendingTransactionModalState>((set, get) => ({
    isOpen: false,
    pendingTransactions: [],
    currentIndex: 0,

    openModal: (transactions) => set({
        isOpen: true,
        pendingTransactions: transactions,
        currentIndex: 0
    }),

    closeModal: () => set({
        isOpen: false,
        pendingTransactions: [],
        currentIndex: 0
    }),

    nextTransaction: () => {
        const { currentIndex, pendingTransactions } = get();
        if (currentIndex < pendingTransactions.length - 1) {
            set({ currentIndex: currentIndex + 1 });
        } else {
            get().closeModal();
        }
    },

    currentTransaction: () => {
        const { pendingTransactions, currentIndex } = get();
        return pendingTransactions[currentIndex] || null;
    },
}));

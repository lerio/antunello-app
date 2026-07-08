"use client";

import { create } from 'zustand';

/**
 * Represents a single pending transaction awaiting user action.
 * Used when importing transactions from an external source (e.g., banking feed)
 * where the user must confirm or dismiss each entry.
 */
interface PendingTransaction {
    /** Unique identifier for the pending transaction record */
    id: string;
    /** External identifier from the source system (e.g., banking API) */
    external_id: string;
    /** Core transaction data that the user will review */
    data: {
        /** Transaction amount */
        amount: number;
        /** ISO 4217 currency code (e.g., "EUR") */
        currency: string;
        /** Date of the transaction (ISO string) */
        date: string;
        /** Transaction description / payee name */
        title: string;
        /** `expense` or `income` */
        type?: 'expense' | 'income';
        /** Optional IBAN of the associated bank account */
        account_iban?: string;
        /** Optional fund category to automatically assign */
        fund_category_id?: string | null;
        /** Original amount before currency conversion (if applicable) */
        original_amount?: number;
        /** Bank's booking date (YYYY-MM-DD) */
        booking_date?: string | null;
        /** Bank's value date (YYYY-MM-DD) */
        value_date?: string | null;
        /** Bank's transaction date (YYYY-MM-DD) */
        transaction_date?: string | null;
    };
}

/**
 * State shape for the pending-transaction review modal.
 * Encapsulates the list of pending transactions and pagination state
 * so the user can step through each one.
 */
interface PendingTransactionModalState {
    /** Whether the modal is currently visible */
    isOpen: boolean;
    /** All pending transactions to review in this batch */
    pendingTransactions: PendingTransaction[];
    /** Index of the transaction currently being displayed */
    currentIndex: number;
    /** Open the modal with a list of pending transactions */
    openModal: (transactions: PendingTransaction[]) => void;
    /** Close the modal and reset state */
    closeModal: () => void;
    /** Advance to the next pending transaction, or close the modal if on the last one */
    nextTransaction: () => void;
    /** Get the currently displayed transaction, or `null` if the list is empty */
    currentTransaction: () => PendingTransaction | null;
}

/**
 * Zustand store for managing the pending-transaction review modal.
 *
 * When importing transactions from external sources (e.g., bank feeds),
 * the user is shown a modal to review and accept or modify each entry.
 * This store tracks the list, current index, and modal visibility.
 */
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

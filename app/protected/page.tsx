"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { PlusIcon, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { useTransactionsOptimized } from "@/hooks/useTransactionsOptimized";
import { useTransactionMutations } from "@/hooks/useTransactionMutations";
import { usePrefetch } from "@/hooks/usePrefetch";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Transaction } from "@/types/database";
import toast from "react-hot-toast";

// Import critical above-the-fold components directly for faster loading
import TransactionsTable from "@/components/features/transactions-table-optimized";
import MonthSummary from "@/components/features/month-summary";

// Lazy load only modal components since they're not immediately visible
const TransactionFormModal = dynamic(
  () => import("@/components/features/transaction-form-modal"),
  { ssr: false }
);

const TransactionEditModal = dynamic(
  () => import("@/components/features/transaction-edit-modal"),
  { ssr: false }
);

export default function ProtectedPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { prefetchSpecificMonth } = usePrefetch();

  // Optimized date parsing from URL
  const currentDate = useMemo(() => {
    if (pathname === "/protected") {
      return new Date();
    }

    const match = pathname.match(/\/protected\/(\d{4})\/(\d{2})/);
    if (match) {
      const [, year, month] = match;
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return isNaN(date.getTime()) ? new Date() : date;
    }

    return new Date();
  }, [pathname]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);

  const { transactions, summary, isLoading, error } = useTransactionsOptimized(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1
  );

  const { addTransaction, updateTransaction, deleteTransaction } =
    useTransactionMutations();

  const handleAddTransaction = useCallback(() => {
    setShowAddModal(true);
  }, []);

  const handleEditTransaction = useCallback((transaction: Transaction) => {
    setEditingTransaction(transaction);
  }, []);

  const handleAddSubmit = useCallback(
    async (data: Omit<Transaction, "id" | "created_at" | "updated_at">) => {
      const toastPromise = addTransaction(data);

      toast.promise(toastPromise, {
        loading: "Adding transaction...",
        success: () => {
          setShowAddModal(false);
          return "Transaction added successfully!";
        },
        error: (err) => {
          return `Failed to add transaction: ${err.message}`;
        },
      });
    },
    [addTransaction]
  );

  const handleEditSubmit = useCallback(
    async (data: Omit<Transaction, "id" | "created_at" | "updated_at">) => {
      if (!editingTransaction) return;

      const toastPromise = updateTransaction(
        editingTransaction.id,
        data,
        editingTransaction.date
      );

      toast.promise(toastPromise, {
        loading: "Updating transaction...",
        success: () => {
          setEditingTransaction(null);
          return "Transaction updated successfully!";
        },
        error: (err) => {
          return `Failed to update transaction: ${err.message}`;
        },
      });
    },
    [updateTransaction, editingTransaction]
  );

  const handleDeleteTransaction = useCallback(
    async (transaction: Transaction) => {
      const toastPromise = deleteTransaction(transaction);

      toast.promise(toastPromise, {
        loading: "Deleting transaction...",
        success: () => {
          setEditingTransaction(null);
          return "Transaction deleted successfully!";
        },
        error: (err) => {
          return `Failed to delete transaction: ${err.message}`;
        },
      });
    },
    [deleteTransaction]
  );

  const navigateMonth = useCallback(
    (direction: "prev" | "next") => {
      const newDate = new Date(currentDate);
      newDate.setMonth(
        currentDate.getMonth() + (direction === "prev" ? -1 : 1)
      );

      const now = new Date();
      const isCurrentMonth =
        newDate.getMonth() === now.getMonth() &&
        newDate.getFullYear() === now.getFullYear();

      if (isCurrentMonth) {
        router.push("/protected");
      } else {
        const year = newDate.getFullYear();
        const month = (newDate.getMonth() + 1).toString().padStart(2, "0");
        router.push(`/protected/${year}/${month}`);
      }
    },
    [currentDate, router]
  );

  // Prefetch adjacent month routes and data for faster navigation
  useEffect(() => {
    const prevDate = new Date(currentDate);
    prevDate.setMonth(currentDate.getMonth() - 1);
    const nextDate = new Date(currentDate);
    nextDate.setMonth(currentDate.getMonth() + 1);

    const now = new Date();
    
    // Prefetch previous month route and data
    const isPrevCurrent = prevDate.getMonth() === now.getMonth() && 
                         prevDate.getFullYear() === now.getFullYear();
    if (!isPrevCurrent) {
      const prevYear = prevDate.getFullYear();
      const prevMonth = (prevDate.getMonth() + 1).toString().padStart(2, "0");
      router.prefetch(`/protected/${prevYear}/${prevMonth}`);
      // Data prefetching is handled by useTransactionsOptimized hook
    } else {
      router.prefetch("/protected");
    }

    // Prefetch next month route and data
    const isNextCurrent = nextDate.getMonth() === now.getMonth() && 
                         nextDate.getFullYear() === now.getFullYear();
    if (!isNextCurrent) {
      const nextYear = nextDate.getFullYear();
      const nextMonth = (nextDate.getMonth() + 1).toString().padStart(2, "0");
      router.prefetch(`/protected/${nextYear}/${nextMonth}`);
      // Data prefetching is handled by useTransactionsOptimized hook
    } else {
      router.prefetch("/protected");
    }
  }, [currentDate, router]);

  const monthYearString = useMemo(() => {
    return currentDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }, [currentDate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">
            Error Loading Transactions
          </h2>
          <p className="text-gray-600">{error.message}</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Sticky Month Selector */}
        <div className="sticky top-0 bg-gray-50 dark:bg-gray-900 z-50 pt-6 pb-4 -mx-6 px-6">
          <div className="flex justify-center items-center mb-8">
            <button 
              onClick={() => navigateMonth("prev")}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
              aria-label="Previous month"
            >
              <ChevronLeft size={24} className="text-gray-600 dark:text-gray-400" />
            </button>
            <h2 className="text-2xl font-semibold mx-6 text-gray-900 dark:text-gray-100">
              {monthYearString}
            </h2>
            <button 
              onClick={() => navigateMonth("next")}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
              aria-label="Next month"
            >
              <ChevronRight size={24} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Balance Summary Card */}
        <MonthSummary transactions={transactions} isLoading={isLoading} />

        {/* Transactions List */}
        {isLoading ? (
          <div className="space-y-4 mt-8">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
                <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-lg"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="transactions-list mt-8">
            <TransactionsTable
              transactions={transactions}
              onTransactionClick={handleEditTransaction}
            />
          </div>
        )}
      </div>

      {/* Floating Add Button - Hidden when modals are open */}
      {!showAddModal && !editingTransaction && (
        <button 
          onClick={handleAddTransaction}
          className="fixed bottom-8 right-8 w-16 h-16 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-full flex items-center justify-center shadow-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors z-60"
          aria-label="Add transaction"
        >
          <Plus size={28} />
        </button>
      )}

      {/* Add Entry Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)}>
        <TransactionFormModal onSubmit={handleAddSubmit} />
      </Modal>

      {/* Edit Entry Modal */}
      <Modal
        isOpen={!!editingTransaction}
        onClose={() => setEditingTransaction(null)}
      >
        {editingTransaction && (
          <TransactionEditModal
            transaction={editingTransaction}
            onSubmit={handleEditSubmit}
            onDelete={handleDeleteTransaction}
          />
        )}
      </Modal>
    </div>
  );
}

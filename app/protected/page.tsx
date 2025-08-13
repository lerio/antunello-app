"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { useTransactionsOptimized } from "@/hooks/useTransactionsOptimized";
import { useTransactionMutations } from "@/hooks/useTransactionMutations";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Transaction } from "@/types/database";
import toast from "react-hot-toast";

import TransactionsTable from "@/components/features/transactions-table-optimized";
import MonthSummary from "@/components/features/month-summary";
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
  const searchParams = useSearchParams();

  const initialDate = useMemo(() => {
    const yearParam = searchParams.get("year");
    const monthParam = searchParams.get("month");

    if (yearParam && monthParam) {
      const year = parseInt(yearParam);
      const month = parseInt(monthParam);
      const date = new Date(year, month - 1);
      return isNaN(date.getTime()) ? new Date() : date;
    }

    return new Date();
  }, [searchParams]);

  const [currentDate, setCurrentDate] = useState(initialDate);

  useEffect(() => {
    setCurrentDate(initialDate);
  }, [initialDate]);

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

      setCurrentDate(newDate);

      const now = new Date();
      const isCurrentMonth =
        newDate.getMonth() === now.getMonth() &&
        newDate.getFullYear() === now.getFullYear();

      const newUrl = isCurrentMonth
        ? "/protected"
        : `/protected?year=${newDate.getFullYear()}&month=${(
            newDate.getMonth() + 1
          )
            .toString()
            .padStart(2, "0")}`;

      window.history.pushState(null, "", newUrl);
    },
    [currentDate]
  );

  const monthYearString = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const displayYear = currentDate.getFullYear();
    
    // Only show year if it's different from current year
    if (displayYear === currentYear) {
      return currentDate.toLocaleDateString("en-US", {
        month: "long",
      });
    } else {
      return currentDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    }
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Sticky Month Selector */}
        <div className="sticky top-0 bg-gray-50 dark:bg-gray-900 z-50 pt-6 pb-4 -mx-6 px-6">
          <div className="relative flex justify-center items-center">
            <button
              onClick={() => navigateMonth("prev")}
              className="absolute left-0 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft
                size={24}
                className="text-gray-600 dark:text-gray-400"
              />
            </button>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {monthYearString}
            </h2>
            <button
              onClick={() => navigateMonth("next")}
              className="absolute right-0 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label="Next month"
            >
              <ChevronRight
                size={24}
                className="text-gray-600 dark:text-gray-400"
              />
            </button>
          </div>
        </div>

        <MonthSummary transactions={transactions} isLoading={isLoading} />

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

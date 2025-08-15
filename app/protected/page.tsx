"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, ArrowUp } from "lucide-react";
import dynamic from "next/dynamic";
import { useTransactionsOptimized } from "@/hooks/useTransactionsOptimized";
import { useTransactionMutations } from "@/hooks/useTransactionMutations";
import { useAvailableMonths } from "@/hooks/useAvailableMonths";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { HorizontalMonthSelector } from "@/components/ui/horizontal-month-selector";
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
  const [showScrollTop, setShowScrollTop] = useState(false);

  const { transactions, summary, isLoading, error } = useTransactionsOptimized(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1
  );

  const { availableMonths, isLoading: monthsLoading } = useAvailableMonths();

  const { addTransaction, updateTransaction, deleteTransaction } =
    useTransactionMutations();

  // Handle scroll to show/hide scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }, []);

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

  const handleMonthSelect = useCallback((year: number, month: number) => {
    const newDate = new Date(year, month - 1, 1);
    setCurrentDate(newDate);

    const now = new Date();
    const isCurrentMonth = 
      month === now.getMonth() + 1 && 
      year === now.getFullYear();

    const newUrl = isCurrentMonth
      ? "/protected"
      : `/protected?year=${year}&month=${month.toString().padStart(2, "0")}`;

    window.history.pushState(null, "", newUrl);
  }, []);

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
        {/* Sticky Horizontal Month Selector */}
        <div className="sticky top-0 bg-gray-50 dark:bg-gray-900 z-50 pt-2 pb-2 -mx-6 px-6">
          {monthsLoading ? (
            <div className="flex justify-center">
              <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-12 w-80 rounded-lg"></div>
            </div>
          ) : (
            <HorizontalMonthSelector
              months={availableMonths}
              selectedMonth={{
                year: currentDate.getFullYear(),
                month: currentDate.getMonth() + 1
              }}
              onMonthSelect={handleMonthSelect}
            />
          )}
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

      {/* Scroll to Top Button */}
      {showScrollTop && !showAddModal && !editingTransaction && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-28 right-8 w-16 h-16 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-full flex items-center justify-center shadow-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-all duration-300 z-60"
          aria-label="Scroll to top"
        >
          <ArrowUp size={28} />
        </button>
      )}

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

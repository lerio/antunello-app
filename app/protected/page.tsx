"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, ArrowUp, Search } from "lucide-react";
import dynamic from "next/dynamic";
import { useTransactionsOptimized } from "@/hooks/useTransactionsOptimized";
import { useTransactionMutations } from "@/hooks/useTransactionMutations";
import { useAvailableMonths } from "@/hooks/useAvailableMonths";
import { useModalState } from "@/hooks/useModalState";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { HorizontalMonthSelector } from "@/components/ui/horizontal-month-selector";
import { FloatingButton } from "@/components/ui/floating-button";
import { Transaction } from "@/types/database";
import toast from "react-hot-toast";

import TransactionsTable from "@/components/features/transactions-table-optimized";
import MonthSummary from "@/components/features/month-summary";
const TransactionFormModal = dynamic(
  () => import("@/components/features/transaction-form-modal"),
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

  const [showScrollTop, setShowScrollTop] = useState(false);

  const {
    showAddModal,
    editingTransaction,
    openAddModal,
    closeAddModal,
    openEditModal,
    closeEditModal,
    hasOpenModal,
  } = useModalState();

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

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, []);

  const handleAddTransaction = useCallback(() => {
    openAddModal();
  }, [openAddModal]);

  const handleEditTransaction = useCallback(
    (transaction: Transaction) => {
      openEditModal(transaction);
    },
    [openEditModal]
  );

  const handleAddSubmit = useCallback(
    async (data: Omit<Transaction, "id" | "created_at" | "updated_at">) => {
      const toastPromise = addTransaction(data);

      toast.promise(toastPromise, {
        loading: "Adding transaction...",
        success: () => {
          closeAddModal();
          return "Transaction added successfully!";
        },
        error: (err) => {
          return `Failed to add transaction: ${err.message}`;
        },
      });
    },
    [addTransaction, closeAddModal]
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
          closeEditModal();
          return "Transaction updated successfully!";
        },
        error: (err) => {
          return `Failed to update transaction: ${err.message}`;
        },
      });
    },
    [updateTransaction, editingTransaction, closeEditModal]
  );

  const handleDeleteTransaction = useCallback(
    async (transaction: Transaction) => {
      const toastPromise = deleteTransaction(transaction);

      toast.promise(toastPromise, {
        loading: "Deleting transaction...",
        success: () => {
          closeEditModal();
          return "Transaction deleted successfully!";
        },
        error: (err) => {
          return `Failed to delete transaction: ${err.message}`;
        },
      });
    },
    [deleteTransaction, closeEditModal]
  );

  const handleMonthSelect = useCallback((year: number, month: number) => {
    const newDate = new Date(year, month - 1, 1);
    setCurrentDate(newDate);

    const now = new Date();
    const isCurrentMonth =
      month === now.getMonth() + 1 && year === now.getFullYear();

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
        {/* Year and Actions Row */}
        <div className="flex items-center justify-between pt-4">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {currentDate.getFullYear()}
            </h2>
            <button
              className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              onClick={() => {
                /* Summary functionality to be implemented */
              }}
            >
              Summary
            </button>
          </div>

          <button
            className="p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            onClick={() => {
              /* Search functionality to be implemented */
            }}
            aria-label="Search transactions"
          >
            <Search size={20} />
          </button>
        </div>

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
                month: currentDate.getMonth() + 1,
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

      {/* Floating Buttons - Hidden when modals are open */}
      {!hasOpenModal && (
        <>
          {showScrollTop && (
            <FloatingButton
              onClick={scrollToTop}
              icon={ArrowUp}
              label="Scroll to top"
              position="stacked"
              className="transition-all duration-300"
            />
          )}
          <FloatingButton
            onClick={handleAddTransaction}
            icon={Plus}
            label="Add transaction"
          />
        </>
      )}

      {/* Add Entry Modal */}
      <Modal isOpen={showAddModal} onClose={closeAddModal}>
        <TransactionFormModal onSubmit={handleAddSubmit} />
      </Modal>

      {/* Edit Entry Modal */}
      <Modal isOpen={!!editingTransaction} onClose={closeEditModal}>
        {editingTransaction && (
          <TransactionFormModal
            initialData={editingTransaction}
            onSubmit={handleEditSubmit}
            onDelete={handleDeleteTransaction}
          />
        )}
      </Modal>
    </div>
  );
}

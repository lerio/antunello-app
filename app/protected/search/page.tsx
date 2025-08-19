"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, ArrowUp, Plus, ArrowLeft } from "lucide-react";
import dynamic from "next/dynamic";
import { useTransactionSearch } from "@/hooks/useTransactionSearch";
import { useModalState } from "@/hooks/useModalState";
import { useTransactionMutations } from "@/hooks/useTransactionMutations";
import { Modal } from "@/components/ui/modal";
import { FloatingButton } from "@/components/ui/floating-button";
import { Button } from "@/components/ui/button";
import { Transaction } from "@/types/database";
import toast from "react-hot-toast";

import TransactionsTable from "@/components/features/transactions-table-optimized";
import SearchSummary from "@/components/features/search-summary";

const TransactionFormModal = dynamic(
  () => import("@/components/features/transaction-form-modal"),
  { ssr: false }
);

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
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

  const {
    results: searchResults,
    isLoading: searchLoading,
    error: searchError,
  } = useTransactionSearch(searchQuery);
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

  // Update URL when search query changes
  useEffect(() => {
    const params = new URLSearchParams();

    // Preserve referrer parameters
    const fromYear = searchParams.get("from_year");
    const fromMonth = searchParams.get("from_month");
    if (fromYear) params.set("from_year", fromYear);
    if (fromMonth) params.set("from_month", fromMonth);

    // Add search query if present
    if (searchQuery) {
      params.set("q", searchQuery);
    }

    const newUrl = params.toString()
      ? `/protected/search?${params}`
      : "/protected/search";
    window.history.replaceState(null, "", newUrl);
  }, [searchQuery, searchParams]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, []);

  const handleBackToTransactions = useCallback(() => {
    // Check if there are referrer params for month/year
    const fromYear = searchParams.get("from_year");
    const fromMonth = searchParams.get("from_month");

    if (fromYear && fromMonth) {
      router.push(`/protected?year=${fromYear}&month=${fromMonth}`);
    } else {
      router.push("/protected");
    }
  }, [router, searchParams]);

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

  return (
    <div>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header spacing */}
        <div className="pt-4"></div>

        {/* Sticky Search Row */}
        <div className="sticky top-0 bg-gray-50 dark:bg-gray-900 z-50 pt-2 pb-2 -mx-6 px-6">
          <div className="flex items-center w-full gap-3 py-3">
            <button
              className="flex-shrink-0 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center font-medium text-sm"
              onClick={handleBackToTransactions}
              aria-label="Back to transactions"
            >
              <ArrowLeft size={16} />
            </button>

            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search transactions..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none font-medium text-sm"
                autoFocus
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <Search
                  size={16}
                  className="text-gray-400 dark:text-gray-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Search Results */}
        {searchLoading ? (
          <div className="space-y-4 mt-8">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
                <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-lg"></div>
              </div>
            ))}
          </div>
        ) : searchError ? (
          <div className="mt-8 text-center py-8">
            <p className="text-red-600 dark:text-red-400">
              Error searching transactions: {searchError.message}
            </p>
          </div>
        ) : searchQuery.trim() && searchResults.length === 0 ? (
          <div className="mt-8 text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              No transactions found
            </p>
          </div>
        ) : searchResults.length > 0 ? (
          <div className="mt-2">
            <SearchSummary transactions={searchResults} />
            <div className="transactions-list">
              <TransactionsTable
                transactions={searchResults}
                onTransactionClick={handleEditTransaction}
                showYear={true}
              />
            </div>
          </div>
        ) : (
          <div className="mt-8 text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              Start typing to search transactions...
            </p>
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

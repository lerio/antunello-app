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
    removeFromResults,
    refetch: refetchSearch,
  } = useTransactionSearch(searchQuery);
  const { addTransaction, updateTransaction, deleteTransaction } =
    useTransactionMutations();

  // Handle scroll to show/hide scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(globalThis.scrollY > 300);
    };

    globalThis.addEventListener("scroll", handleScroll);
    return () => globalThis.removeEventListener("scroll", handleScroll);
  }, []);

  // Note: We don't sync searchQuery to URL dynamically to avoid navigation conflicts.
  // The URL is set once when navigating to this page via handleSearchClick.
  // The initial search query is loaded from the ?q= param if present.

  const scrollToTop = useCallback(() => {
    globalThis.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, []);

  const handleBackToTransactions = useCallback(() => {
    // Check if there are referrer params for month/year
    const fromYear = searchParams.get("from_year");
    const fromMonth = searchParams.get("from_month");

    if (fromYear && fromMonth) {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      // If it's the current month/year, navigate to clean URL without query params
      const isCurrentMonth =
        Number.parseInt(fromYear) === currentYear &&
        Number.parseInt(fromMonth) === currentMonth;

      if (isCurrentMonth) {
        router.push("/protected/transactions");
      } else {
        router.push(
          `/protected/transactions?year=${fromYear}&month=${fromMonth}`
        );
      }
    } else {
      router.push("/protected/transactions");
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
      // Optimistically remove from UI
      removeFromResults(transaction.id);

      const toastPromise = deleteTransaction(transaction);

      toast.promise(toastPromise, {
        loading: "Deleting transaction...",
        success: () => {
          // Ensure search is in sync with DB
          refetchSearch();
          closeEditModal();
          return "Transaction deleted successfully!";
        },
        error: (err) => {
          // On error, refetch to restore previous results
          refetchSearch();
          return `Failed to delete transaction: ${err.message}`;
        },
      });
    },
    [deleteTransaction, removeFromResults, refetchSearch, closeEditModal]
  );

  return (
    <div>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header spacing */}
        <div className="pt-2"></div>

        {/* Sticky Search Row */}
        <div className="sticky top-0 bg-gray-50 dark:bg-gray-900 z-50 pt-2 pb-2 -mx-6 px-6">
          <div className="flex items-center w-full gap-2 pb-4">
            <button
              className="flex-shrink-0 px-2 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center font-medium text-sm"
              onClick={handleBackToTransactions}
              aria-label="Back to transactions"
            >
              <ArrowLeft size={16} />
            </button>

            <div className="relative flex-1">
              <input
                name="search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search transactions..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none font-medium text-sm"
                autoFocus
              />
              <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                <Search
                  size={20}
                  className="text-gray-400 dark:text-gray-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Search Results */}
        {searchLoading && (
          <div className="space-y-4 mt-8">
            {["s1", "s2", "s3", "s4", "s5"].map((key) => (
              <div key={key} className="animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
                <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-lg"></div>
              </div>
            ))}
          </div>
        )}
        {searchError && (
          <div className="mt-8 text-center py-8">
            <p className="text-red-600 dark:text-red-400">
              Error searching transactions: {searchError.message}
            </p>
          </div>
        )}
        {!searchLoading &&
          !searchError &&
          searchQuery.trim() &&
          searchResults.length === 0 && (
            <div className="mt-8 text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                No transactions found
              </p>
            </div>
          )}
        {!searchLoading && !searchError && searchResults.length > 0 && (
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
        )}
        {!searchLoading &&
          !searchError &&
          !searchQuery.trim() &&
          searchResults.length === 0 && (
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
        <TransactionFormModal
          onSubmit={handleAddSubmit}
          onClose={closeAddModal}
        />
      </Modal>

      {/* Edit Entry Modal */}
      <Modal isOpen={!!editingTransaction} onClose={closeEditModal}>
        {editingTransaction && (
          <TransactionFormModal
            initialData={editingTransaction}
            onSubmit={handleEditSubmit}
            onDelete={handleDeleteTransaction}
            onClose={closeEditModal}
          />
        )}
      </Modal>
    </div>
  );
}

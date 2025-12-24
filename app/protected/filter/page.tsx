"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUp, ArrowLeft } from "lucide-react";
import dynamic from "next/dynamic";
import { useFilteredTransactions, FilterCriteria, initialFilterCriteria } from "@/hooks/useFilteredTransactions";
import { useModalState } from "@/hooks/useModalState";
import { useTransactionMutations } from "@/hooks/useTransactionMutations";
import { Modal } from "@/components/ui/modal";
import { FloatingButton } from "@/components/ui/floating-button";
import { Transaction } from "@/types/database";
import toast from "react-hot-toast";

import TransactionsTable from "@/components/features/transactions-table-optimized";
import SearchSummary from "@/components/features/search-summary";
import { FilterControls } from "@/components/features/filter-controls";
import { createClient } from "@/utils/supabase/client";

const TransactionFormModal = dynamic(
  () => import("@/components/features/transaction-form-modal"),
  { ssr: false }
);

// Preload the form component after page hydration for smoother modal animations
if (typeof window !== "undefined") {
  const preload = () => import("@/components/features/transaction-form-modal");
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(preload);
  } else {
    setTimeout(preload, 1000);
  }
}

export default function FilterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [availableCurrencies, setAvailableCurrencies] = useState<string[]>([]);

  const [criteria, setCriteria] = useState<FilterCriteria>(initialFilterCriteria);

  const {
    editingTransaction,
    openEditModal,
    closeEditModal,
    hasOpenModal,
  } = useModalState();

  const {
    results: filterResults,
    isLoading: filterLoading,
    error: filterError,
    removeFromResults,
    refetch: refetchFilter,
  } = useFilteredTransactions(criteria, hasInteracted);

  const { updateTransaction, deleteTransaction } =
    useTransactionMutations();

  // Fetch available currencies on mount
  useEffect(() => {
    const fetchCurrencies = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("transactions")
        .select("currency")
        .limit(1000);

      if (!error && data) {
        const currencies = Array.from(new Set(data.map((t) => t.currency))).sort();
        setAvailableCurrencies(currencies);
      }
    };

    fetchCurrencies();
  }, []);

  // Handle scroll to show/hide scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(globalThis.scrollY > 300);
    };

    globalThis.addEventListener("scroll", handleScroll);
    return () => globalThis.removeEventListener("scroll", handleScroll);
  }, []);

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

  const handleCriteriaChange = useCallback((newCriteria: FilterCriteria) => {
    setCriteria(newCriteria);
    setHasInteracted(true);
  }, []);

  const handleEditTransaction = useCallback(
    (transaction: Transaction) => {
      openEditModal(transaction);
    },
    [openEditModal]
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
          refetchFilter();
          return "Transaction updated successfully!";
        },
        error: (err) => {
          return `Failed to update transaction: ${err.message}`;
        },
      });
    },
    [updateTransaction, editingTransaction, closeEditModal, refetchFilter]
  );

  const handleDeleteTransaction = useCallback(
    async (transaction: Transaction) => {
      // Optimistically remove from UI
      removeFromResults(transaction.id);

      const toastPromise = deleteTransaction(transaction);

      toast.promise(toastPromise, {
        loading: "Deleting transaction...",
        success: () => {
          // Ensure filter is in sync with DB
          refetchFilter();
          closeEditModal();
          return "Transaction deleted successfully!";
        },
        error: (err) => {
          // On error, refetch to restore previous results
          refetchFilter();
          return `Failed to delete transaction: ${err.message}`;
        },
      });
    },
    [deleteTransaction, removeFromResults, refetchFilter, closeEditModal]
  );

  // Check if any filter is actually applied (for "All time" message)
  const isAllTime = criteria.month === null && criteria.year === null;

  return (
    <div>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header spacing */}
        <div className="pt-2"></div>

        {/* Back Button Row */}
        <div className="sticky top-0 bg-gray-50 dark:bg-gray-900 z-50 pt-2 pb-2 -mx-6 px-6">
          <div className="flex items-center w-full gap-2 pb-4">
            <button
              className="flex-shrink-0 px-2 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center font-medium text-sm"
              onClick={handleBackToTransactions}
              aria-label="Back to transactions"
            >
              <ArrowLeft size={16} />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Filter
            </h1>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="mb-4">
          <FilterControls
            criteria={criteria}
            onCriteriaChange={handleCriteriaChange}
            availableCurrencies={availableCurrencies}
          />
        </div>

        {/* Filter Results */}
        {!hasInteracted && (
          <div className="mt-8 text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              Adjust filters to see transactions...
            </p>
          </div>
        )}

        {hasInteracted && filterLoading && (
          <div className="space-y-4 mt-8">
            {["s1", "s2", "s3", "s4", "s5"].map((key) => (
              <div key={key} className="animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
                <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-lg"></div>
              </div>
            ))}
          </div>
        )}

        {hasInteracted && filterError && (
          <div className="mt-8 text-center py-8">
            <p className="text-red-600 dark:text-red-400">
              Error filtering transactions: {filterError.message}
            </p>
          </div>
        )}

        {hasInteracted &&
          !filterLoading &&
          !filterError &&
          filterResults.length === 0 && (
            <div className="mt-8 text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                No transactions match the current filters
              </p>
            </div>
          )}

        {hasInteracted && !filterLoading && !filterError && filterResults.length > 0 && (
          <div className="mt-2">
            <SearchSummary transactions={filterResults} />
            <div className="transactions-list">
              <TransactionsTable
                transactions={filterResults}
                onTransactionClick={handleEditTransaction}
                showYear={isAllTime}
              />
            </div>
          </div>
        )}
      </div>

      {/* Floating Button - Scroll to top */}
      {!hasOpenModal && showScrollTop && (
        <FloatingButton
          onClick={scrollToTop}
          icon={ArrowUp}
          label="Scroll to top"
          className="transition-all duration-300"
        />
      )}

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

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, ArrowUp, Search, Filter, RefreshCw } from "lucide-react";
import { useTransactionsOptimized } from "@/hooks/useTransactionsOptimized";
import { useTransactionMutations } from "@/hooks/useTransactionMutations";
import { useAvailableMonths } from "@/hooks/useAvailableMonths";
import { useModalState } from "@/hooks/useModalState";
import { useBackgroundSync } from "@/hooks/useBackgroundSync";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useFundCategories } from "@/hooks/useFundCategories";
import { usePendingTransactionModal } from "@/hooks/usePendingTransactionModal";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { HorizontalMonthSelector } from "@/components/ui/horizontal-month-selector";
import { FloatingButton } from "@/components/ui/floating-button";
import { TransactionViewTabs } from "@/components/ui/transaction-view-tabs";
import { UpdateBanner } from "@/components/ui/update-banner";
import { PullToRefreshIndicator } from "@/components/ui/pull-to-refresh-indicator";
import { Transaction } from "@/types/database";
import { createClient } from "@/utils/supabase/client";
import { transactionCache } from "@/utils/simple-cache";
import toast from "react-hot-toast";
import useSWR from "swr";

import TransactionsTable from "@/components/features/transactions-table-optimized";
import TransactionSummary from "@/components/features/transaction-summary";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionListSkeleton } from "@/components/ui/skeletons";


import TransactionFormModal from "@/components/features/transaction-form-modal";
import { usePendingTransactions } from "@/hooks/usePendingTransactions";
import { PendingTransactionsButton } from "@/components/features/pending-transactions-button";
import { cn } from "@/lib/utils"; // Will verify if this exists in next steps, otherwise remove

export default function ProtectedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [userId, setUserId] = useState<string | undefined>(undefined);

  const initialDate = useMemo(() => {
    const yearParam = searchParams.get("year");
    const monthParam = searchParams.get("month");

    if (yearParam && monthParam) {
      const year = Number.parseInt(yearParam, 10);
      const month = Number.parseInt(monthParam, 10);
      const date = new Date(year, month - 1);
      return Number.isNaN(date.getTime()) ? new Date() : date;
    }

    return new Date();
  }, [searchParams]);

  const [currentDate, setCurrentDate] = useState(initialDate);

  useEffect(() => {
    setCurrentDate(initialDate);
  }, [initialDate]);

  // Get user ID for background sync
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getUser();
  }, [supabase]);

  const [showScrollTop, setShowScrollTop] = useState(false);

  const {
    showAddModal,
    editingTransaction,
    openAddModal,
    closeAddModal,
    openEditModal,
    closeEditModal,
    hasOpenModal,
    isEditModalOpen,
  } = useModalState();


  // ... inside component ...

  // Pending transaction modal state
  const {
    isOpen: isPendingModalOpen,
    currentTransaction,
    nextTransaction,
    closeModal: closePendingModal,
    openModal // Added openModal
  } = usePendingTransactionModal();

  // Fetch pending transactions
  const { data: pendingTransactions, mutate: mutatePending } = usePendingTransactions();

  const { transactions, isLoading, error, mutate } = useTransactionsOptimized(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1
  );

  const { availableMonths, isLoading: monthsLoading } = useAvailableMonths();

  // Prefetch fund categories to avoid lag when opening the add modal
  // The modal uses this data, and it's heavy to calculate (balances)
  useFundCategories();

  const { addTransaction, updateTransaction, deleteTransaction } =
    useTransactionMutations();

  // Background sync for detecting updates
  const {
    hasUpdates,
    updateCount,
    dismissUpdate,
    refreshData,
    recordLocalMutation,
  } = useBackgroundSync(userId);

  // Pull-to-refresh functionality
  const { isPulling, pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: async () => {
      // Clear cache before refreshing
      transactionCache.clearRelated(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1
      );
      await mutate();
    },
    disabled: hasOpenModal, // Disable when modals are open
  });

  // Handle scroll to show/hide scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      const win = globalThis as unknown as Window;
      setShowScrollTop(typeof win.scrollY === "number" && win.scrollY > 300);
    };

    if (typeof globalThis.addEventListener === "function") {
      globalThis.addEventListener("scroll", handleScroll as EventListener);
      return () =>
        globalThis.removeEventListener("scroll", handleScroll as EventListener);
    }
    return undefined;
  }, []);

  const scrollToTop = useCallback(() => {
    const win = globalThis as unknown as Window;
    if (typeof win.scrollTo === "function") {
      win.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  }, []);

  const handleSearchClick = useCallback(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;

    router.push(
      `/protected/search?from_year=${year}&from_month=${month
        .toString()
        .padStart(2, "0")}`
    );
  }, [router, currentDate]);

  const handleFilterClick = useCallback(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;

    router.push(
      `/protected/filter?from_year=${year}&from_month=${month
        .toString()
        .padStart(2, "0")}`
    );
  }, [router, currentDate]);

  const handleCategoryClick = useCallback(
    (category: string) => {
      router.push(`/protected/category/${encodeURIComponent(category)}`);
    },
    [router]
  );

  const handleSubCategoryClick = useCallback(
    (category: string, subCategory: string) => {
      router.push(
        `/protected/category/${encodeURIComponent(category)}/${encodeURIComponent(subCategory)}`
      );
    },
    [router]
  );

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
      const toastPromise = addTransaction(data).then(async (result) => {
        await recordLocalMutation();
        return result;
      });

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
    [addTransaction, closeAddModal, recordLocalMutation]
  );

  // Handle pending transaction submit
  const handlePendingSubmit = useCallback(
    async (data: Omit<Transaction, "id" | "created_at" | "updated_at">) => {
      const currentPending = currentTransaction();
      if (!currentPending) return;

      try {
        // Add the transaction
        await addTransaction(data);
        await recordLocalMutation();

        // Mark as processed
        await supabase
          .from('pending_transactions')
          .update({ status: 'added' })
          .eq('id', currentPending.id);

        // Refresh pending list
        await mutatePending();

        // Move to next or close
        toast.success("Transaction added!");
        nextTransaction();
      } catch (error: any) {
        toast.error(`Failed to add transaction: ${error.message}`);
      }
    },
    [addTransaction, currentTransaction, nextTransaction, recordLocalMutation, supabase, mutatePending]
  );

  // Handle skip (cancel) pending transaction
  const handleSkipPending = useCallback(
    async () => {
      const currentPending = currentTransaction();
      if (!currentPending) return;

      try {
        // Mark as processed (skipped)
        await supabase
          .from('pending_transactions')
          .update({ status: 'dismissed' })
          .eq('id', currentPending.id);

        await mutatePending();
        toast("Skipped");
        nextTransaction();
      } catch (error: any) {
        toast.error(`Failed to skip: ${error.message}`);
      }
    },
    [currentTransaction, nextTransaction, supabase, mutatePending]
  );

  const handleEditSubmit = useCallback(
    async (data: Omit<Transaction, "id" | "created_at" | "updated_at">) => {
      if (!editingTransaction) return;

      const toastPromise = updateTransaction(
        editingTransaction.id,
        data,
        editingTransaction.date
      ).then(async (result) => {
        await recordLocalMutation();
        return result;
      });

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
    [updateTransaction, editingTransaction, closeEditModal, recordLocalMutation]
  );

  const handleDeleteTransaction = useCallback(
    async (transaction: Transaction) => {
      const toastPromise = deleteTransaction(transaction).then(
        async (result) => {
          await recordLocalMutation();
          return result;
        }
      );

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
    [deleteTransaction, closeEditModal, recordLocalMutation]
  );

  /* REMOVED: history.pushState manual handling */
  const handleMonthSelect = useCallback(
    (year: number, month: number) => {
      // Optimistic update
      const newDate = new Date(year, month - 1, 1);
      setCurrentDate(newDate);

      const now = new Date();
      // Check if selected month/year is the current month/year
      const isCurrentMonth =
        month === now.getMonth() + 1 && year === now.getFullYear();

      if (isCurrentMonth) {
        router.push("/protected/transactions");
      } else {
        router.push(
          `/protected/transactions?month=${month
            .toString()
            .padStart(2, "0")}&year=${year}`
        );
      }
    },
    [router]
  );

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">
            Error Loading Transactions
          </h2>
          <p className="text-gray-600">{error.message}</p>
          <Button onClick={() => mutate()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
      />

      {hasUpdates && (
        <UpdateBanner
          updateCount={updateCount}
          onRefresh={() =>
            refreshData(mutate, {
              year: currentDate.getFullYear(),
              month: currentDate.getMonth() + 1,
            })
          }
          onDismiss={dismissUpdate}
        />
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* View Tabs and Actions Row */}
        <div className="flex items-center justify-between pt-4 pb-2">
          <TransactionViewTabs
            currentView="month"
            year={currentDate.getFullYear()}
            month={currentDate.getMonth() + 1}
          />

          <div className="flex items-center gap-2">
            <button
              className="p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              onClick={async () => {
                const toastId = toast.loading("Fetching transactions...");
                try {
                  const res = await fetch("/api/transactions/bulk-fetch", {
                    method: "POST",
                  });
                  const data = await res.json();

                  if (!res.ok) throw new Error(data.error || "Fetch failed");

                  if (data.results && data.results.length > 0) {
                    const totalNew = data.results.reduce((acc: number, r: any) => acc + (r.new_pending || 0), 0);
                    if (totalNew > 0) {
                      toast.success(`Found ${totalNew} new transactions!`, { id: toastId });
                      mutatePending(); // Refresh pending list bubble
                    } else {
                      toast.success("Fetch complete. No new transactions.", { id: toastId });
                    }
                  } else {
                    toast.success(data.message || "Fetch complete", { id: toastId });
                  }
                } catch (e: any) {
                  toast.error(`Fetch error: ${e.message}`, { id: toastId });
                }
              }}
              aria-label="Fetch transactions"
            >
              <RefreshCw size={20} />
            </button>
            <button
              className="p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              onClick={handleFilterClick}
              aria-label="Filter transactions"
            >
              <Filter size={20} />
            </button>
            <button
              className="p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              onClick={handleSearchClick}
              aria-label="Search transactions"
            >
              <Search size={20} />
            </button>
          </div>
        </div>

        {/* Sticky Horizontal Month Selector */}
        <div className="sticky top-0 bg-gray-50 dark:bg-gray-900 z-50 py-2 -mx-6">
          {monthsLoading ? (
            <div className="flex justify-center">
              <Skeleton className="h-12 w-80 rounded-lg" />
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

        <TransactionSummary transactions={transactions} isLoading={isLoading} />

        <div className="transactions-list mt-4">
          <TransactionsTable
            transactions={transactions}
            onTransactionClick={handleEditTransaction}
            onCategoryClick={handleCategoryClick}
            onSubCategoryClick={handleSubCategoryClick}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Floating Buttons - Hidden when modals are open */}
      {!hasOpenModal && (
        <>
          {/* Pending Transactions Button */}
          {pendingTransactions && pendingTransactions.length > 0 && (
            <PendingTransactionsButton
              count={pendingTransactions.length}
              onClick={() => openModal(pendingTransactions)}
              bottomOffsetClass="bottom-40"
            />
          )}

          {showScrollTop && (
            <FloatingButton
              onClick={scrollToTop}
              icon={ArrowUp}
              label="Scroll to top"
              position="stacked"
              className={cn(
                "transition-all duration-300",
                pendingTransactions && pendingTransactions.length > 0 ? "bottom-60" : ""
              )}
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
      <Modal isOpen={isEditModalOpen} onClose={closeEditModal}>
        {editingTransaction && (
          <TransactionFormModal
            initialData={editingTransaction}
            onSubmit={handleEditSubmit}
            onDelete={handleDeleteTransaction}
            onClose={closeEditModal}
          />
        )}
      </Modal>

      {/* Pending Transaction Modal */}
      <Modal isOpen={isPendingModalOpen} onClose={closePendingModal}>
        {(() => {
          const pending = currentTransaction();
          if (!pending) return null;

          const initialData = {
            amount: Math.abs(pending.data.amount),
            currency: pending.data.currency,
            date: pending.data.date,
            title: pending.data.title,
            type: pending.data.type || 'expense', // Use the type from pending data
            fund_category_id: pending.data.fund_category_id || null,
          } as any;

          return (
            <TransactionFormModal
              key={pending.id}
              initialData={initialData}
              onSubmit={handlePendingSubmit}
              onClose={handleSkipPending}
            />
          );
        })()}
      </Modal>
    </div>
  );
}

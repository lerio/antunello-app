"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, ArrowUp, Search } from "lucide-react";
import dynamic from "next/dynamic";
import { useTransactionsOptimized } from "@/hooks/useTransactionsOptimized";
import { useTransactionMutations } from "@/hooks/useTransactionMutations";
import { useAvailableMonths } from "@/hooks/useAvailableMonths";
import { useModalState } from "@/hooks/useModalState";
import { useBackgroundSync } from "@/hooks/useBackgroundSync";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
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

import TransactionsTable from "@/components/features/transactions-table-optimized";
import TransactionSummary from "@/components/features/transaction-summary";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionListSkeleton } from "@/components/ui/skeletons";

const TransactionFormModal = dynamic(
  () => import("@/components/features/transaction-form-modal"),
  { ssr: false }
);

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
  } = useModalState();

  const { transactions, isLoading, error, mutate } = useTransactionsOptimized(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1
  );

  const { availableMonths, isLoading: monthsLoading } = useAvailableMonths();

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

          <button
            className="p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            onClick={handleSearchClick}
            aria-label="Search transactions"
          >
            <Search size={20} />
          </button>
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
            isLoading={isLoading}
          />
        </div>
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

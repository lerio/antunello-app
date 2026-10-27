"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, ArrowUp, Search, RefreshCw } from "lucide-react";
import { useTransactionsOptimized } from "@/hooks/useTransactionsOptimized";
import { useTransactionMutations } from "@/hooks/useTransactionMutations";
import { useAvailableMonths } from "@/hooks/useAvailableMonths";
import { useModalState } from "@/hooks/useModalState";
import { useBackgroundSync } from "@/hooks/useBackgroundSync";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useFundCategories } from "@/hooks/useFundCategories";
import { usePendingTransactionModal } from "@/hooks/usePendingTransactionModal";
import { useSplitSourcesForYear } from "@/hooks/useSplitSourcesForYear";
import { usePrefetch } from "@/hooks/usePrefetch";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { HorizontalMonthSelector } from "@/components/ui/horizontal-month-selector";
import { FloatingButton } from "@/components/ui/floating-button";
import { TransactionViewTabs } from "@/components/ui/transaction-view-tabs";
import { PullToRefreshIndicator } from "@/components/ui/pull-to-refresh-indicator";
import { Transaction } from "@/types/database";
import { createClient } from "@/utils/supabase/client";
import { transactionCache } from "@/utils/simple-cache";
import toast from "react-hot-toast";
import { mutate as globalMutate } from "swr";

import TransactionsTable from "@/components/features/transactions-table-optimized";
import TransactionSummary from "@/components/features/transaction-summary";
import { Skeleton } from "@/components/ui/skeleton";
import {
  calculateExpectedSplitAmountEur,
  expandSplitTransactionsForMonth,
} from "@/utils/split-transactions";
import { createMonthKey } from "@/utils/transaction-fetcher";
import { buildTrBonusRows } from "@/utils/tr-bonuses";
import { isReadOnlyTransaction } from "@/utils/transaction-utils";

import TransactionFormModal from "@/components/features/transaction-form-modal";
import { usePendingTransactions } from "@/hooks/usePendingTransactions";
import { PendingTransactionsButton } from "@/components/features/pending-transactions-button";
import { cn } from "@/lib/utils";

export default function ProtectedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

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

  // Key to force Modal remount when switching from split child to original
  const [editModalKey, setEditModalKey] = useState(0);
  const pendingOriginalRef = useRef<Transaction | null>(null);

  // When the edit modal closes with a pending original transaction, reopen it
  // with a fresh key to avoid the 300ms close-animation race condition.
  useEffect(() => {
    if (!isEditModalOpen && pendingOriginalRef.current) {
      const tx = pendingOriginalRef.current;
      pendingOriginalRef.current = null;
      setEditModalKey((k) => k + 1);
      openEditModal(tx);
    }
  }, [isEditModalOpen, openEditModal]);

  // Pending transaction modal state
  const {
    isOpen: isPendingModalOpen,
    currentTransaction,
    nextTransaction,
    closeModal: closePendingModal,
    openModal,
  } = usePendingTransactionModal();

  // Fetch pending transactions
  const { data: pendingTransactions, mutate: mutatePending } =
    usePendingTransactions();

  const { transactions, isLoading, error, mutate } = useTransactionsOptimized(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
  );
  const selectedYear = currentDate.getFullYear();
  const selectedMonth = currentDate.getMonth() + 1;

  const { prefetchAdjacentMonths } = usePrefetch();

  // Prefetch adjacent months for instant navigation. Lives here (not in
  // useTransactionsOptimized) so other pages sharing that hook — e.g. the
  // budgets page — don't pay the prefetch cost on load.
  useEffect(() => {
    if (!isLoading && !error) {
      prefetchAdjacentMonths(selectedYear, selectedMonth);
    }
  }, [selectedYear, selectedMonth, isLoading, error, prefetchAdjacentMonths]);

  const { data: splitSources = [] } = useSplitSourcesForYear(selectedYear);

  const expectedSplitAmountEur = useMemo(() => {
    if (!splitSources.length) return 0;

    const monthEnd = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);
    const allSplitForMonth = expandSplitTransactionsForMonth(
      [],
      splitSources,
      selectedYear,
      selectedMonth,
      monthEnd,
    );
    return calculateExpectedSplitAmountEur(allSplitForMonth, transactions);
  }, [splitSources, selectedYear, selectedMonth, transactions]);

  const { availableMonths, isLoading: monthsLoading } = useAvailableMonths();

  // Prefetch fund categories to avoid lag when opening the add modal
  // The modal uses this data, and it's heavy to calculate (balances).
  // Also used to name the TR round-up money transfer bonus rows.
  const { fundCategories } = useFundCategories();

  const { addTransaction, addBonusTransactions, updateTransaction, deleteTransaction } =
    useTransactionMutations();

  // Background sync for detecting updates (provider is mounted in the
  // /protected layout; the update banner is rendered there)
  const { recordLocalMutation } = useBackgroundSync();

  // Pull-to-refresh functionality
  const { pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: async () => {
      // Clear cache before refreshing
      transactionCache.clearRelated(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
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
        .padStart(2, "0")}`,
    );
  }, [router, currentDate]);

  const handleCategoryClick = useCallback(
    (category: string) => {
      router.push(`/protected/category/${encodeURIComponent(category)}`);
    },
    [router],
  );

  const handleSubCategoryClick = useCallback(
    (category: string, subCategory: string) => {
      router.push(
        `/protected/category/${encodeURIComponent(category)}/${encodeURIComponent(subCategory)}`,
      );
    },
    [router],
  );

  const handleAddTransaction = useCallback(() => {
    openAddModal();
  }, [openAddModal]);

  const handleEditTransaction = useCallback(
    (transaction: Transaction) => {
      openEditModal(transaction);
    },
    [openEditModal],
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
    [addTransaction, closeAddModal, recordLocalMutation],
  );

  // Handle pending transaction submit
  const handlePendingSubmit = useCallback(
    async (data: Omit<Transaction, "id" | "created_at" | "updated_at">) => {
      const currentPending = currentTransaction();
      if (!currentPending) return;

      try {
        // Add the transaction
        const persistedCard = await addTransaction(data);

        // Create linked TR bonus transactions (saveback income / round-up
        // money transfer) when the timeline carried the amounts for this
        // card transaction. Applied to new imports only — the pending data
        // is enriched by the Render sync.
        const { rows: bonusRows, warnings } = buildTrBonusRows(
          currentPending,
          persistedCard.id,
          fundCategories,
        );
        for (const warning of warnings) toast(warning);

        if (bonusRows.length > 0) {
          try {
            await addBonusTransactions(bonusRows);
          } catch (bonusError: any) {
            // Compensate: remove the just-created card row so re-accepting
            // the still-pending transaction does not duplicate it.
            await deleteTransaction(persistedCard).catch((compensationError) =>
              console.error("Bonus compensation failed:", compensationError),
            );
            throw new Error(
              `Transaction added but bonus creation failed: ${bonusError.message} — please delete the card transaction and re-accept.`,
            );
          }
        }

        await recordLocalMutation();

        // Mark as processed
        await supabase
          .from("pending_transactions")
          .update({ status: "added" })
          .eq("id", currentPending.id);

        // Refresh pending list
        await mutatePending();

        // Move to next or close
        toast.success("Transaction added!");
        nextTransaction();
      } catch (error: any) {
        toast.error(`Failed to add transaction: ${error.message}`);
      }
    },
    [
      addTransaction,
      addBonusTransactions,
      deleteTransaction,
      fundCategories,
      currentTransaction,
      nextTransaction,
      recordLocalMutation,
      supabase,
      mutatePending,
    ],
  );

  // Handle skip (cancel) pending transaction
  const handleSkipPending = useCallback(async () => {
    const currentPending = currentTransaction();
    if (!currentPending) return;

    try {
      // Mark as processed (skipped)
      await supabase
        .from("pending_transactions")
        .update({ status: "dismissed" })
        .eq("id", currentPending.id);

      await mutatePending();
      toast("Skipped");
      nextTransaction();
    } catch (error: any) {
      toast.error(`Failed to skip: ${error.message}`);
    }
  }, [currentTransaction, nextTransaction, supabase, mutatePending]);

  const handleEditSubmit = useCallback(
    async (data: Omit<Transaction, "id" | "created_at" | "updated_at">) => {
      if (!editingTransaction) return;

      const toastPromise = updateTransaction(
        editingTransaction.id,
        data,
        editingTransaction.date,
      ).then(async (result) => {
        await recordLocalMutation();
        // Clear the simple LRU cache so transactionFetcher hits Supabase
        // instead of returning stale data with old split children.
        const monthKey = createMonthKey(selectedYear, selectedMonth);
        transactionCache.delete(monthKey);
        // Also invalidate the split-sources SWR cache.
        globalMutate(`split-sources-${selectedYear}`, undefined, true);
        // Trigger SWR to re-fetch the month data.
        await mutate();
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
    [
      updateTransaction,
      editingTransaction,
      closeEditModal,
      recordLocalMutation,
      mutate,
      selectedYear,
      selectedMonth,
    ],
  );

  const handleDeleteTransaction = useCallback(
    async (transaction: Transaction) => {
      const toastPromise = deleteTransaction(transaction).then(
        async (result) => {
          await recordLocalMutation();
          return result;
        },
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
    [deleteTransaction, closeEditModal, recordLocalMutation],
  );

  const handleViewOriginal = useCallback(
    async (sourceId: string) => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", sourceId)
        .single();

      if (!data) return;

      pendingOriginalRef.current = data as Transaction;
      closeEditModal();
    },
    [closeEditModal, supabase],
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
            .padStart(2, "0")}&year=${year}`,
        );
      }
    },
    [router],
  );

  return (
    <div>
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
      />

      <div className="mx-auto max-w-3xl px-4 pb-40 sm:px-6 md:pb-8 lg:max-w-[1200px] lg:px-8">
        <h2 className="hidden md:block pt-4 text-2xl font-bold text-gray-900 dark:text-white">
          Activity
        </h2>

        {/* View Tabs and Actions Row */}
        <div className="flex items-center justify-between pt-4 pb-2 md:pt-2">
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
                    const totalNew = data.results.reduce(
                      (acc: number, r: any) => acc + (r.new_pending || 0),
                      0,
                    );
                    if (totalNew > 0) {
                      toast.success(`Found ${totalNew} new transactions!`, {
                        id: toastId,
                      });
                      mutatePending();
                    } else {
                      // The count separates "the bank returned nothing" from
                      // "everything it returned was already imported".
                      const totalFetched = data.results.reduce(
                        (acc: number, r: any) => acc + (r.fetched || 0),
                        0,
                      );
                      toast.success(
                        `Fetch complete. No new transactions (${totalFetched} fetched from the bank).`,
                        { id: toastId },
                      );
                    }

                    // Show per-account errors.
                    const errors = data.results.filter((r: any) => r.error);
                    for (const r of errors) {
                      const name = r.bank_name || r.account || 'Unknown';
                      const msg = r.error.includes('429') || r.error.includes('RATE_LIMIT')
                        ? `${name}: daily API limit reached. Try again tomorrow.`
                        : `${name}: ${r.error}`;
                      toast.error(msg, { duration: 6000 });
                    }
                  } else {
                    toast.success(data.message || "Fetch complete", {
                      id: toastId,
                    });
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
              onClick={handleSearchClick}
              aria-label="Search transactions"
            >
              <Search size={20} />
            </button>
            <Button
              onClick={handleAddTransaction}
              size="sm"
              className="hidden md:inline-flex"
            >
              <Plus size={16} />
              Add transaction
            </Button>
          </div>
        </div>

        {/* Sticky Horizontal Month Selector */}
        <div className="sticky top-0 z-50 bg-gray-50 py-2 dark:bg-gray-900">
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

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* Summary first in the DOM so mobile reads it before the list. */}
          <div className="lg:order-2 lg:col-span-5 lg:sticky lg:top-[68px] lg:-mt-6">
            {error ? (
              <div className="rounded-2xl border border-border bg-white p-4 text-sm text-muted-foreground dark:bg-gray-800">
                Couldn&apos;t load this month&apos;s summary.
              </div>
            ) : (
              <TransactionSummary
                transactions={transactions}
                isLoading={isLoading}
                selectedYear={selectedYear}
                selectedMonth={selectedMonth}
                expectedSplitAmountEur={expectedSplitAmountEur}
              />
            )}
          </div>

          <div className="transactions-list lg:order-1 lg:col-span-7">
            {error ? (
              <div className="rounded-2xl border border-border bg-white p-6 text-center dark:bg-gray-800">
                <p className="text-sm text-muted-foreground">
                  Couldn&apos;t load this month&apos;s transactions.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {error.message}
                </p>
                <Button onClick={() => mutate()} className="mt-3">
                  Retry
                </Button>
              </div>
            ) : (
              <TransactionsTable
                transactions={transactions}
                onTransactionClick={handleEditTransaction}
                onCategoryClick={handleCategoryClick}
                onSubCategoryClick={handleSubCategoryClick}
                isLoading={isLoading}
                emptyMessage={`No transactions in ${currentDate.toLocaleDateString(
                  "en-GB",
                  { month: "long" },
                )}`}
              />
            )}
          </div>
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
                pendingTransactions && pendingTransactions.length > 0
                  ? "bottom-60"
                  : "",
              )}
            />
          )}
          <FloatingButton
            onClick={handleAddTransaction}
            icon={Plus}
            label="Add transaction"
            className="md:hidden"
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
      <Modal
        key={editModalKey}
        isOpen={isEditModalOpen}
        onClose={closeEditModal}
      >
        {editingTransaction && (
          <TransactionFormModal
            initialData={editingTransaction}
            onSubmit={handleEditSubmit}
            onDelete={isReadOnlyTransaction(editingTransaction) ? undefined : handleDeleteTransaction}
            onViewOriginal={handleViewOriginal}
            disabled={isReadOnlyTransaction(editingTransaction)}
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
            type: pending.data.type || "expense", // Use the type from pending data
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

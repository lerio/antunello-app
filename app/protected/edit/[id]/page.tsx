"use client";

import { useRouter } from "next/navigation";
import { use } from "react";
import dynamic from "next/dynamic";

// Lazy load the form for better initial page load
const TransactionForm = dynamic(() => import("@/components/features/transaction-form-optimized"), {
  loading: () => (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-16 bg-gray-200 rounded"></div>
        <div className="h-16 bg-gray-200 rounded"></div>
        <div className="h-16 bg-gray-200 rounded"></div>
        <div className="h-16 bg-gray-200 rounded"></div>
      </div>
      <div className="h-16 bg-gray-200 rounded"></div>
      <div className="h-10 bg-blue-200 rounded"></div>
    </div>
  )
});
import { Transaction } from "@/types/database";
import { ArrowLeft } from "lucide-react";
import { useTransactionMutations } from "@/hooks/useTransactionMutations";
import { useTransaction } from "@/hooks/useTransaction";
import toast from "react-hot-toast";

export default function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const { updateTransaction, deleteTransaction } = useTransactionMutations();
  const { transaction, isLoading, error } = useTransaction(resolvedParams.id);

  if (error) {
    toast.error("Failed to load transaction");
    router.push("/protected");
    return null;
  }

  const handleSubmit = async (
    data: Omit<Transaction, "id" | "created_at" | "updated_at">
  ) => {
    if (!transaction) return;

    const toastPromise = updateTransaction(
      transaction.id,
      data,
      transaction.date
    );

    toast.promise(toastPromise, {
      loading: "Updating transaction...",
      success: () => {
        router.push("/protected");
        return "Transaction updated successfully!";
      },
      error: (err) => {
        return `Failed to update transaction: ${err.message}`;
      },
    });
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this transaction? This action cannot be undone."
      )
    )
      return;
    if (!transaction) return;

    const toastPromise = deleteTransaction(transaction);

    toast.promise(toastPromise, {
      loading: "Deleting transaction...",
      success: () => {
        router.push("/protected");
        return "Transaction deleted successfully!";
      },
      error: (err) => {
        return `Failed to delete transaction: ${err.message}`;
      },
    });
  };

  const handleBack = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="flex items-center mb-6">
            <div className="h-5 w-5 bg-gray-300 rounded mr-2"></div>
            <div className="h-4 bg-gray-300 rounded w-12"></div>
          </div>
          <div className="h-8 bg-gray-300 rounded w-48 mb-6"></div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-16 bg-gray-200 rounded"></div>
              <div className="h-16 bg-gray-200 rounded"></div>
              <div className="h-16 bg-gray-200 rounded"></div>
              <div className="h-16 bg-gray-200 rounded"></div>
            </div>
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-10 bg-blue-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!transaction) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button
        onClick={handleBack}
        className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-6 cursor-pointer"
      >
        <ArrowLeft size={20} className="mr-1" />
        Back
      </button>

      <h1 className="text-2xl font-bold mb-6">Edit Transaction</h1>
      <TransactionForm initialData={transaction} onSubmit={handleSubmit} />
      <div className="mt-2 pt-2">
        <button
          onClick={handleDelete}
          className="w-full bg-red-600 text-white p-2 rounded hover:bg-red-700"
        >
          Delete Transaction
        </button>
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { use, useState } from "react";
import dynamic from "next/dynamic";
import { Transaction } from "@/types/database";
import { ArrowLeft, Edit3, Trash2, AlertTriangle } from "lucide-react";
import { useTransactionMutations } from "@/hooks/useTransactionMutations";
import { useTransaction } from "@/hooks/useTransaction";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";

// Lazy load the modern form
const TransactionForm = dynamic(() => import("@/components/features/transaction-form-modern"), {
  loading: () => (
    <div className="w-full max-w-2xl mx-auto animate-pulse space-y-6">
      {/* Type Toggle Skeleton */}
      <div className="h-16 bg-gray-200 rounded-xl"></div>
      
      {/* Amount and Currency Row Skeleton */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 h-16 bg-gray-200 rounded-xl"></div>
        <div className="h-16 bg-gray-200 rounded-xl"></div>
      </div>
      
      {/* Title Skeleton */}
      <div className="h-16 bg-gray-200 rounded-xl"></div>
      
      {/* Categories Row Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="h-16 bg-gray-200 rounded-xl"></div>
        <div className="h-16 bg-gray-200 rounded-xl"></div>
      </div>
      
      {/* Date Skeleton */}
      <div className="h-16 bg-gray-200 rounded-xl"></div>
      
      {/* Button Skeleton */}
      <div className="h-14 bg-blue-200 rounded-xl"></div>
    </div>
  )
});

export default function EditTransactionPageModern({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const { updateTransaction, deleteTransaction } = useTransactionMutations();
  const { transaction, isLoading, error } = useTransaction(resolvedParams.id);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
    
    setShowDeleteConfirm(false);
  };

  const handleBack = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        {/* Header Skeleton */}
        <div className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200/50 dark:border-gray-700/50">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse"></div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-xl animate-pulse"></div>
                <div>
                  <div className="w-32 h-5 bg-gray-200 rounded animate-pulse mb-1"></div>
                  <div className="w-48 h-4 bg-gray-200 rounded animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-6 md:p-8">
            <div className="w-full max-w-2xl mx-auto animate-pulse space-y-6">
              <div className="h-16 bg-gray-200 rounded-xl"></div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 h-16 bg-gray-200 rounded-xl"></div>
                <div className="h-16 bg-gray-200 rounded-xl"></div>
              </div>
              <div className="h-16 bg-gray-200 rounded-xl"></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="h-16 bg-gray-200 rounded-xl"></div>
                <div className="h-16 bg-gray-200 rounded-xl"></div>
              </div>
              <div className="h-16 bg-gray-200 rounded-xl"></div>
              <div className="h-14 bg-blue-200 rounded-xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!transaction) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Modern Header */}
      <div className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200/50 dark:border-gray-700/50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleBack} 
              className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft size={20} />
            </Button>
            
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 text-white rounded-xl">
                <Edit3 size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Edit Transaction</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Update your transaction details</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-6 md:p-8">
          <TransactionForm initialData={transaction} onSubmit={handleSubmit} />
        </div>
        
        {/* Delete Section */}
        <div className="mt-6 bg-red-50 dark:bg-red-900/20 rounded-2xl p-6 border border-red-200/50 dark:border-red-800/50">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-xl">
              <AlertTriangle size={20} />
            </div>
            
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 dark:text-red-100 mb-2">Danger Zone</h3>
              <p className="text-sm text-red-800 dark:text-red-200 mb-4">
                Once you delete this transaction, it cannot be recovered. This action is permanent.
              </p>
              
              {!showDeleteConfirm ? (
                <Button
                  onClick={() => setShowDeleteConfirm(true)}
                  variant="outline"
                  className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <Trash2 size={16} className="mr-2" />
                  Delete Transaction
                </Button>
              ) : (
                <div className="flex gap-3">
                  <Button
                    onClick={handleDelete}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Trash2 size={16} className="mr-2" />
                    Confirm Delete
                  </Button>
                  <Button
                    onClick={() => setShowDeleteConfirm(false)}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
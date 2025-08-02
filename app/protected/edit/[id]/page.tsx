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

// Lazy load the HTML-design form
const TransactionForm = dynamic(() => import("@/components/features/transaction-form-html-design"), {
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

export default function EditTransactionPage({
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
      <div className="min-h-screen" style={{ fontFamily: 'Inter, sans-serif', backgroundColor: '#f7fafc' }}>
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="w-full max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-6 md:p-8 lg:p-12 animate-pulse">
            {/* Header Skeleton */}
            <div className="flex items-center mb-10">
              <div className="flex items-center">
                <div className="w-5 h-5 bg-gray-300 rounded mr-2"></div>
                <div className="w-12 h-4 bg-gray-300 rounded"></div>
              </div>
            </div>
            
            <div className="w-48 h-10 bg-gray-300 rounded mb-2"></div>
            <div className="w-96 h-4 bg-gray-200 rounded mb-12"></div>
            
            {/* Form Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div className="h-16 bg-gray-200 rounded-lg"></div>
              <div className="h-16 bg-gray-200 rounded-lg"></div>
              <div className="h-16 bg-gray-200 rounded-lg"></div>
              <div className="h-16 bg-gray-200 rounded-lg"></div>
              <div className="md:col-span-2 h-12 bg-gray-200 rounded-lg"></div>
              <div className="h-12 bg-gray-200 rounded-lg"></div>
            </div>
            
            <div className="mt-12 h-14 bg-indigo-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!transaction) return null;

  return (
    <div className="min-h-screen" style={{ fontFamily: 'Inter, sans-serif', backgroundColor: '#f7fafc' }}>
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full space-y-6">
          <TransactionForm initialData={transaction} onSubmit={handleSubmit} onBack={handleBack} />
          
          {/* Delete Section */}
          <div className="max-w-4xl mx-auto bg-red-50 rounded-2xl p-6 border border-red-200">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-red-100 text-red-600 rounded-xl">
                <AlertTriangle size={20} />
              </div>
              
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 mb-2">Danger Zone</h3>
                <p className="text-sm text-red-800 mb-4">
                  Once you delete this transaction, it cannot be recovered. This action is permanent.
                </p>
                
                {!showDeleteConfirm ? (
                  <Button
                    onClick={() => setShowDeleteConfirm(true)}
                    variant="outline"
                    className="border-red-200 text-red-700 hover:bg-red-50"
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
    </div>
  );
}
"use client";

import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft, Plus } from "lucide-react";
import { useTransactionMutations } from "@/hooks/useTransactionMutations";
import { Transaction } from "@/types/database";
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

export default function AddTransactionPageModern() {
  const router = useRouter();
  const { addTransaction } = useTransactionMutations();

  const handleSubmit = async (
    data: Omit<Transaction, "id" | "created_at" | "updated_at">
  ) => {
    const toastPromise = addTransaction(data);

    toast.promise(toastPromise, {
      loading: "Adding transaction...",
      success: () => {
        router.push("/protected");
        return "Transaction added successfully!";
      },
      error: (err) => {
        return `Failed to add transaction: ${err.message}`;
      },
    });
  };

  const handleBack = () => {
    router.back();
  };

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
                <Plus size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Add Transaction</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Track your expenses and income</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-6 md:p-8">
          <TransactionForm onSubmit={handleSubmit} />
        </div>
        
        {/* Tips Card */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6 border border-blue-200/50 dark:border-blue-800/50">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">💡 Quick Tips</h3>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Use descriptive titles to easily identify transactions later</li>
            <li>• Choose the correct category for better spending insights</li>
            <li>• The date can be adjusted for past transactions</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
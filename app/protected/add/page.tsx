"use client";

import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft, Plus } from "lucide-react";
import { useTransactionMutations } from "@/hooks/useTransactionMutations";
import { Transaction } from "@/types/database";
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

export default function AddTransactionPage() {
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
    <div className="min-h-screen" style={{ fontFamily: 'Inter, sans-serif', backgroundColor: '#f7fafc' }}>
      <div className="min-h-screen flex items-center justify-center px-4">
        <TransactionForm onSubmit={handleSubmit} onBack={handleBack} />
      </div>
    </div>
  );
}

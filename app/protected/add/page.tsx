"use client";

import { useRouter } from "next/navigation";
import TransactionForm from "@/components/features/transaction-form";
import { ArrowLeft } from "lucide-react";
import { useTransactionMutations } from "@/hooks/useTransactionMutations";
import { Transaction } from "@/types/database";
import toast from "react-hot-toast";

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
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button
        onClick={handleBack}
        className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-6 cursor-pointer"
      >
        <ArrowLeft size={20} className="mr-1" />
        Back
      </button>

      <h1 className="text-2xl font-bold mb-6">Add New Transaction</h1>
      <TransactionForm onSubmit={handleSubmit} />
    </div>
  );
}

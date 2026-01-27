"use client";

import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useTransactionMutations } from "@/hooks/useTransactionMutations";
import { Transaction } from "@/types/database";
import toast from "react-hot-toast";
import { Suspense, useMemo } from "react";

// Lazy load the HTML-design form
const TransactionForm = dynamic(() => import("@/components/features/transaction-form-html-design"), {
  loading: () => (
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
  )
});

function AddTransactionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addTransaction } = useTransactionMutations();

  const initialData = useMemo(() => {
    if (!searchParams.size) return undefined;

    // Extract search params
    const amount = searchParams.get('amount');
    const currency = searchParams.get('currency');
    const title = searchParams.get('title');
    const date = searchParams.get('date');
    const type = searchParams.get('type');
    const externalId = searchParams.get('external_id');
    const pendingId = searchParams.get('pending_id');

    if (!amount && !title) return undefined;

    return {
      amount: amount ? parseFloat(amount) : 0,
      // Handle unknown currency by defaulting or letting form handle it
      currency: currency || 'EUR',
      title: title || '',
      date: date || new Date().toISOString(),
      type: (type === 'income' || type === 'expense') ? type : 'expense',
      // We might want to pass pending_id to delete it after success, 
      // but for now, let's just prefill.
      // Ideally, the form submission should handle the "cleanup" of the pending transaction.
      // We can do this by passing a hidden field or handling it in the wrapper.
    } as Partial<Transaction> as Transaction; // Type assertion since it's partial
  }, [searchParams]);

  const handleSubmit = async (
    data: Omit<Transaction, "id" | "created_at" | "updated_at">
  ) => {
    // If we have a pending_id, we should mark it as 'added' or delete it after successful addition.
    // For now, let's just add the transaction.
    const pendingId = searchParams.get('pending_id');

    const toastPromise = (async () => {
      await addTransaction(data);
      // Clean up pending transaction if it exists
      if (pendingId) {
        // We need an endpoint or action to update pending_transaction status
        // For MVP, we can just fire and forget a fetch call to an API route (to be created)
        // or we can add it to the mutations hook.
        // Let's assume we'll implement that later or the user manually dismisses it.
        // Actually, let's trigger a cleanup via API for better UX.
        try {
          await fetch(`/api/pending-transactions/${pendingId}`, { method: 'DELETE' });
        } catch (e) {
          console.error("Failed to clear pending transaction", e);
        }
      }
    })();

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

  return <TransactionForm onSubmit={handleSubmit} onBack={handleBack} initialData={initialData} />;
}

export default function AddTransactionPage() {
  return (
    <div className="min-h-screen" style={{ fontFamily: 'Inter, sans-serif', backgroundColor: '#f7fafc' }}>
      <div className="min-h-screen flex items-center justify-center px-4">
        <Suspense fallback={<div>Loading...</div>}>
          <AddTransactionContent />
        </Suspense>
      </div>
    </div>
  );
}

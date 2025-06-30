"
"use client";

import { useRouter } from "next/navigation";
import TransactionForm from "@/components/features/transaction-form";
import { ArrowLeft } from "lucide-react";
import { useTransactionMutations } from "@/hooks/useTransactionMutations";
import { Transaction } from "@/types/database";
import toast from "react-hot-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
    <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
      <Button variant="ghost" onClick={handleBack} className="mb-6">
        <ArrowLeft size={20} className="mr-2" />
        Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Add New Transaction</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionForm onSubmit={handleSubmit} />
        </CardContent>
      </Card>
    </div>
  );
}


"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageStack } from "@/components/layout/page-container";
import { Modal } from "@/components/ui/modal";
import { FloatingButton } from "@/components/ui/floating-button";
import { FundForm, type FundFormValues } from "@/components/features/fund-form";
import { createClient } from "@/utils/supabase/client";
import { FundCategory } from "@/types/database";
import { useFundCategories } from "@/hooks/useFundCategories";
import { Plus, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";

const iconButtonClass = "h-8 w-8 text-muted-foreground";

export default function FundCategoriesManager() {
  const { fundCategories, isLoading, mutate } = useFundCategories();
  // The same modal serves both: editingFund undefined means "add".
  // It stays set on close so the form stays rendered during the slide-out animation.
  const [editingFund, setEditingFund] = useState<FundCategory | undefined>();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const supabase = createClient();

  const openEdit = (fund: FundCategory) => {
    setEditingFund(fund);
    setIsModalOpen(true);
  };
  const openAdd = () => {
    setEditingFund(undefined);
    setIsModalOpen(true);
  };
  const closeModal = () => setIsModalOpen(false);

  const handleSubmit = async (values: FundFormValues) => {
    const fields = {
      name: values.name,
      description: values.description || null,
      currency: values.currency,
      amount: values.amount,
      is_active: values.is_active,
      top_level_category: values.top_level_category || null,
    };

    if (editingFund) {
      const { error } = await supabase
        .from("fund_categories")
        .update(fields)
        .eq("id", editingFund.id);
      if (error) throw error;
    } else {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("User not authenticated");

      const { error } = await supabase.from("fund_categories").insert({
        ...fields,
        user_id: userData.user.id,
        order_index: fundCategories.length,
      });
      if (error) throw error;
    }

    mutate();
    closeModal();
  };

  const handleDelete = async () => {
    if (!editingFund) return;
    const { error } = await supabase
      .from("fund_categories")
      .delete()
      .eq("id", editingFund.id);
    if (error) throw error;

    mutate();
    closeModal();
  };

  return (
    <PageStack>
        {/* Fund Categories List: one card per fund, like the bank cards */}
          {(() => {
            if (isLoading) {
              return (
                <>
                  {['s1','s2','s3'].map((k) => (
                    <div
                      key={k}
                      className="h-24 rounded-2xl bg-gray-200 dark:bg-gray-700 animate-pulse"
                    />
                  ))}
                </>
              );
            }
            if (fundCategories.length === 0) {
              return (
                <Card className="py-10 text-center">
                  <p className="text-muted-foreground">
                    No fund categories configured yet.
                  </p>
                </Card>
              );
            }
            return (
              [...fundCategories]
                .sort((a, b) => a.order_index - b.order_index)
                .map((fund) => (
                  <Card key={fund.id}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold m-0">{fund.name}</h3>
                          {!fund.is_active && (
                            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={() => openEdit(fund)}
                        size="icon"
                        variant="ghost"
                        className={cn(iconButtonClass, "shrink-0 hover:text-primary")}
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                        <span className="sr-only">Edit {fund.name}</span>
                      </Button>
                    </div>

                    <div className="mt-3 space-y-1">
                      {fund.description && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {fund.description}
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                        <span>Initial amount: {fund.amount.toFixed(2)} {fund.currency}</span>
                        {fund.top_level_category && (
                          <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                            {fund.top_level_category}
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
            );
          })()}

        <FloatingButton onClick={openAdd} icon={Plus} label="Add fund" />

        <Modal isOpen={isModalOpen} onClose={closeModal}>
          <FundForm
            key={editingFund?.id ?? "new"}
            initialData={editingFund}
            onSubmit={handleSubmit}
            onDelete={editingFund ? handleDelete : undefined}
            onClose={closeModal}
          />
        </Modal>
    </PageStack>
  );
}

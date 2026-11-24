"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageStack } from "@/components/layout/page-container";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";
import { FundCategory, TOP_LEVEL_FUND_CATEGORIES } from "@/types/database";
import { useFundCategories } from "@/hooks/useFundCategories";
import { Plus, Trash2, Edit2, Save, X, ChevronDown } from "lucide-react";
import { CURRENCIES } from "@/constants/app-constants";
import { getSelectClass } from "@/utils/styling-utils";
import { cn } from "@/lib/utils";

const iconButtonClass = "h-8 w-8 text-muted-foreground";

/** A native select with the caret drawn inset, matching the Settings selects. */
function ChevronSelect({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        {...props}
        className={cn(getSelectClass(), "w-full appearance-none pr-10", className)}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export default function FundCategoriesManager() {
  const { fundCategories, isLoading, mutate } = useFundCategories();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newFund, setNewFund] = useState<Partial<FundCategory>>({
    name: "",
    description: "",
    currency: "EUR",
    amount: 0,
    is_active: true,
    order_index: 0,
    top_level_category: "",
  });

  const supabase = createClient();

  const handleAddFund = async () => {
    if (!newFund.name || newFund.amount === undefined) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("User not authenticated");

      const { error } = await supabase.from("fund_categories").insert({
        user_id: userData.user.id,
        name: newFund.name,
        description: newFund.description || null,
        currency: newFund.currency || "EUR",
        amount: newFund.amount || 0,
        is_active: newFund.is_active !== false,
        order_index: fundCategories.length,
        top_level_category: newFund.top_level_category || null,
      });

      if (error) throw error;

      setNewFund({
        name: "",
        description: "",
        currency: "EUR",
        amount: 0,
        is_active: true,
        order_index: 0,
        top_level_category: "",
      });
      setIsAdding(false);
      mutate();
    } catch (error) {
      console.error("Error adding fund:", error);
    }
  };

  const handleUpdateFund = async (fund: FundCategory) => {
    try {
      const { error } = await supabase
        .from("fund_categories")
        .update({
          name: fund.name,
          description: fund.description || null,
          currency: fund.currency,
          amount: fund.amount,
          is_active: fund.is_active,
          top_level_category: fund.top_level_category || null,
        })
        .eq("id", fund.id);

      if (error) throw error;

      setEditingId(null);
      mutate();
    } catch (error) {
      console.error("Error updating fund:", error);
    }
  };

  const handleDeleteFund = async (id: string) => {
    if (!confirm("Are you sure you want to delete this fund category?")) return;

    try {
      const { error } = await supabase
        .from("fund_categories")
        .delete()
        .eq("id", id);

      if (error) throw error;
      mutate();
    } catch (error) {
      console.error("Error deleting fund:", error);
    }
  };


  return (
    <PageStack>
        {/* Add New Fund Form */}
        {isAdding && (
          <Card className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={newFund.name}
                  onChange={(e) => setNewFund({ ...newFund, name: e.target.value })}
                  placeholder="e.g., Bank Account, Investment"
                />
              </div>
              <div>
                <Label htmlFor="top_level_category">Top Level Category</Label>
                <ChevronSelect
                  id="top_level_category"
                  value={newFund.top_level_category || ""}
                  onChange={(e) => setNewFund({ ...newFund, top_level_category: e.target.value })}
                  
                >
                  <option value="">No Category</option>
                  {TOP_LEVEL_FUND_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </ChevronSelect>
              </div>
              <div>
                <Label htmlFor="currency">Currency</Label>
                <ChevronSelect
                  id="currency"
                  value={newFund.currency}
                  onChange={(e) => setNewFund({ ...newFund, currency: e.target.value })}
                  
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </ChevronSelect>
              </div>
              <div>
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={newFund.amount}
                  onChange={(e) => setNewFund({ ...newFund, amount: Number.parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={newFund.description}
                  onChange={(e) => setNewFund({ ...newFund, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="active"
                checked={newFund.is_active}
                onChange={(e) => setNewFund({ ...newFund, is_active: e.target.checked })}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <Label htmlFor="active">Active</Label>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddFund} size="sm">
                <Save className="w-4 h-4 mr-1" />
                Save
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsAdding(false)}
                size="sm"
              >
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
            </div>
          </Card>
        )}

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
              fundCategories
                .sort((a, b) => a.order_index - b.order_index)
                .map((fund) => (
                  <Card key={fund.id}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {editingId !== fund.id && (
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold m-0">{fund.name}</h3>
                            {!fund.is_active && (
                              <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                                Inactive
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                      {editingId === fund.id ? (
                        <>
                          <Button
                            onClick={() => handleUpdateFund(fund)}
                            size="icon"
                            variant="ghost"
                            className={cn(iconButtonClass, "hover:text-primary")}
                            title="Save"
                          >
                            <Save className="w-4 h-4" />
                            <span className="sr-only">Save</span>
                          </Button>
                          <Button
                            onClick={() => setEditingId(null)}
                            size="icon"
                            variant="ghost"
                            className={iconButtonClass}
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                            <span className="sr-only">Cancel</span>
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            onClick={() => setEditingId(fund.id)}
                            size="icon"
                            variant="ghost"
                            className={cn(iconButtonClass, "hover:text-primary")}
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                            <span className="sr-only">Edit {fund.name}</span>
                          </Button>
                          <Button
                            onClick={() => handleDeleteFund(fund.id)}
                            size="icon"
                            variant="ghost"
                            className={cn(iconButtonClass, "hover:text-destructive")}
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="sr-only">Delete {fund.name}</span>
                          </Button>
                        </>
                      )}
                      </div>
                    </div>

                    <div className="mt-3">
                      {editingId === fund.id ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Input
                              value={fund.name}
                              onChange={(e) =>
                                mutate(
                                  fundCategories.map((f) =>
                                    f.id === fund.id ? { ...f, name: e.target.value } : f
                                  ),
                                  false
                                )
                              }
                              placeholder="Name"
                            />
                            <ChevronSelect
                              value={fund.top_level_category || ""}
                              onChange={(e) =>
                                mutate(
                                  fundCategories.map((f) =>
                                    f.id === fund.id ? { ...f, top_level_category: e.target.value } : f
                                  ),
                                  false
                                )
                              }
                              
                            >
                              <option value="">No Category</option>
                              {TOP_LEVEL_FUND_CATEGORIES.map((category) => (
                                <option key={category} value={category}>
                                  {category}
                                </option>
                              ))}
                            </ChevronSelect>
                            <ChevronSelect
                              value={fund.currency}
                              onChange={(e) =>
                                mutate(
                                  fundCategories.map((f) =>
                                    f.id === fund.id ? { ...f, currency: e.target.value } : f
                                  ),
                                  false
                                )
                              }
                              
                            >
                              {CURRENCIES.map((currency) => (
                                <option key={currency} value={currency}>
                                  {currency}
                                </option>
                              ))}
                            </ChevronSelect>
                            <Input
                              type="number"
                              step="0.01"
                              value={fund.amount}
                              onChange={(e) =>
                                mutate(
                                  fundCategories.map((f) =>
                                    f.id === fund.id
                                      ? { ...f, amount: Number.parseFloat(e.target.value) || 0 }
                                      : f
                                  ),
                                  false
                                )
                              }
                              placeholder="Amount"
                            />
                            <Input
                              value={fund.description || ""}
                              onChange={(e) =>
                                mutate(
                                  fundCategories.map((f) =>
                                    f.id === fund.id
                                      ? { ...f, description: e.target.value }
                                      : f
                                  ),
                                  false
                                )
                              }
                              placeholder="Description"
                            />
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={fund.is_active}
                              onChange={(e) =>
                                mutate(
                                  fundCategories.map((f) =>
                                    f.id === fund.id ? { ...f, is_active: e.target.checked } : f
                                  ),
                                  false
                                )
                              }
                              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                            />
                            <Label>Active</Label>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {fund.description && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {fund.description}
                            </div>
                          )}
                          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                            <span>{fund.amount.toFixed(2)} {fund.currency}</span>
                            {fund.top_level_category && (
                              <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                                {fund.top_level_category}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                  </Card>
                ))
            );
          })()}

        {/* Add New Button */}
        {!isAdding && (
          <div className="flex justify-center">
            <Button
              onClick={() => setIsAdding(true)}
              variant="outline"
              className="w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Fund Category
            </Button>
          </div>
        )}
    </PageStack>
  );
}
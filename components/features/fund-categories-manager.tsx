"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";
import { FundCategory, TOP_LEVEL_FUND_CATEGORIES } from "@/types/database";
import { useFundCategories } from "@/hooks/useFundCategories";
import { Plus, Trash2, Edit, Save, X } from "lucide-react";
import { CURRENCIES } from "@/constants/app-constants";
import { getSelectClass } from "@/utils/styling-utils";

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
    <Card>
      <CardHeader>
        <CardTitle className="text-blue-600">💰 Fund Categories</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Manage your fund categories for the balance overview. Each fund can have its own currency.
        </p>

        {/* Add New Fund Form */}
        {isAdding && (
          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md space-y-3">
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
                <select
                  id="top_level_category"
                  value={newFund.top_level_category || ""}
                  onChange={(e) => setNewFund({ ...newFund, top_level_category: e.target.value })}
                  className={getSelectClass()}
                >
                  <option value="">No Category</option>
                  {TOP_LEVEL_FUND_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="currency">Currency</Label>
                <select
                  id="currency"
                  value={newFund.currency}
                  onChange={(e) => setNewFund({ ...newFund, currency: e.target.value })}
                  className={getSelectClass()}
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
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
          </div>
        )}

        {/* Fund Categories List */}
        <div className="space-y-2">
          {(() => {
            if (isLoading) {
              return (
                <div className="space-y-2">
                  {['s1','s2','s3'].map((k) => (
                    <div
                      key={k}
                      className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                    />
                  ))}
                </div>
              );
            }
            if (fundCategories.length === 0) {
              return (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No fund categories configured yet.
                </p>
              );
            }
            return (
              fundCategories
                .sort((a, b) => a.order_index - b.order_index)
                .map((fund, index) => (
                  <div
                    key={fund.id}
                    className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-md"
                  >
                    <div className="flex-1">
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
                            <select
                              value={fund.top_level_category || ""}
                              onChange={(e) =>
                                mutate(
                                  fundCategories.map((f) =>
                                    f.id === fund.id ? { ...f, top_level_category: e.target.value } : f
                                  ),
                                  false
                                )
                              }
                              className={getSelectClass()}
                            >
                              <option value="">No Category</option>
                              {TOP_LEVEL_FUND_CATEGORIES.map((category) => (
                                <option key={category} value={category}>
                                  {category}
                                </option>
                              ))}
                            </select>
                            <select
                              value={fund.currency}
                              onChange={(e) =>
                                mutate(
                                  fundCategories.map((f) =>
                                    f.id === fund.id ? { ...f, currency: e.target.value } : f
                                  ),
                                  false
                                )
                              }
                              className={getSelectClass()}
                            >
                              {CURRENCIES.map((currency) => (
                                <option key={currency} value={currency}>
                                  {currency}
                                </option>
                              ))}
                            </select>
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
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-800 dark:text-gray-200">
                              {fund.name}
                            </span>
                            {!fund.is_active && (
                              <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">
                                Inactive
                              </span>
                            )}
                          </div>
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

                    <div className="flex items-center gap-1">
                      {editingId === fund.id ? (
                        <>
                          <Button
                            onClick={() => handleUpdateFund(fund)}
                            size="sm"
                            variant="outline"
                          >
                            <Save className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => setEditingId(null)}
                            size="sm"
                            variant="outline"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            onClick={() => setEditingId(fund.id)}
                            size="sm"
                            variant="outline"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => handleDeleteFund(fund.id)}
                            size="sm"
                            variant="outline"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))
            );
          })()}
        </div>

        {/* Add New Button */}
        {!isAdding && (
          <Button
            onClick={() => setIsAdding(true)}
            variant="outline"
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add New Fund Category
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
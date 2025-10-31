"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/utils/currency";
import { FundCategoryWithBalance, useFundCategories } from "@/hooks/useFundCategories";

export default function Balance() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const { fundCategories, isLoading, error, totalBalanceEUR } = useFundCategories();

  if (error) return null;

  const formatAmount = (amount: number) =>
    formatCurrency(amount, "EUR")
      .replaceAll("€", "")
      .replaceAll("$", "")
      .replaceAll("£", "")
      .replaceAll("¥", "")
      .replaceAll("₹", "");

  const amountColorClass = totalBalanceEUR >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

  // Group funds by top-level category
  const groupedFunds = fundCategories
    .filter(fund => fund.is_active)
    .reduce((acc, fund) => {
      const category = fund.top_level_category || "Uncategorized";
      if (!acc[category]) {
        acc[category] = {
          totalEUR: 0,
          funds: []
        };
      }
      acc[category].totalEUR += fund.current_eur_amount || 0;
      acc[category].funds.push(fund);
      return acc;
    }, {} as Record<string, { totalEUR: number; funds: FundCategoryWithBalance[] }>);

  // Sort categories by total amount (descending)
  const sortedCategories = Object.entries(groupedFunds)
    .sort(([, a], [, b]) => b.totalEUR - a.totalEUR);

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-3 sm:p-4 mb-2 mt-4 sm:mb-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-200 m-0">Balance</h3>
        <div className="flex items-center gap-2">
          <div className={`text-base sm:text-lg font-semibold ${amountColorClass}`}>
            {isLoading ? (
              <span className="inline-block w-20 h-[1.375rem] bg-gray-200 dark:bg-gray-700 rounded animate-pulse align-middle" />
            ) : (
              <>€{formatAmount(Math.abs(totalBalanceEUR))}</>
            )}
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            aria-label={isExpanded ? "Collapse balance details" : "Expand balance details"}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div>
          {(() => {
            if (isLoading) {
              return (
                <div className="space-y-2">
                  {['s1','s2','s3'].map((k) => (
                    <div key={k} className="flex justify-between items-center">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse" />
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse" />
                    </div>
                  ))}
                </div>
              );
            }
            if (fundCategories.length === 0) {
              return (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                  No fund categories configured. Add some in the admin settings.
                </p>
              );
            }
            return (
              <div className="space-y-1">
                {sortedCategories.map(([category, { totalEUR, funds }]) => {
                  const isCategoryExpanded = expandedCategories.has(category);
                  const sortedFunds = funds.sort((a, b) => (b.current_eur_amount || 0) - (a.current_eur_amount || 0));

                  return (
                    <div key={category}>
                      {/* Category Header */}
                      {(() => {
                        const contentId = `category-${category.toLowerCase().replace(/[^a-z0-9_-]/gi, "-")}`;
                        return (
                          <button
                            type="button"
                            className="w-full flex justify-between items-center py-2 px-2 hover:bg-gray-50 dark:hover:bg-gray-750 rounded transition-colors text-left"
                            onClick={() => toggleCategory(category)}
                            aria-expanded={isCategoryExpanded}
                            aria-controls={contentId}
                          >
                            <div className="flex items-center gap-2">
                              <span className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors" aria-hidden="true">
                                {isCategoryExpanded ? (
                                  <ChevronDown size={16} className="text-gray-500" />
                                ) : (
                                  <ChevronRight size={16} className="text-gray-500" />
                                )}
                              </span>
                              <div>
                                <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                  {category}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {funds.length} fund{funds.length === 1 ? '' : 's'}
                                </div>
                              </div>
                            </div>
                            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              €{formatAmount(Math.abs(totalEUR))}
                            </div>
                          </button>
                        );
                      })()}

                      {/* Individual Funds */}
                      {isCategoryExpanded && (
                        <div id={`category-${category.toLowerCase().replace(/[^a-z0-9_-]/gi, "-")}`} className="ml-6 space-y-1">
                          {sortedFunds.map((fund) => (
                            <div
                              key={fund.id}
                              className="flex justify-between items-center py-1 px-2 hover:bg-gray-50 dark:hover:bg-gray-750 rounded"
                            >
                              <div className="flex-1">
                                <div className="text-sm text-gray-700 dark:text-gray-300">
                                  {fund.name}
                                </div>
                                {fund.description && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {fund.description}
                                  </div>
                                )}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {formatCurrency(fund.current_amount || fund.amount, fund.currency)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
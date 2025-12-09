"use client";

import { useState, useMemo, useCallback } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/utils/currency";
import { formatAmountWithoutSymbol } from "@/utils/format-utils";
import { getCurrencyIcon } from "@/utils/currency-icons";
import { FundCategoryWithBalance, useFundCategories } from "@/hooks/useFundCategories";
import { Skeleton } from "@/components/ui/skeleton";
import { BalanceSkeleton } from "@/components/ui/skeletons";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { PrivacyBlur } from "@/components/ui/privacy-blur";

export default function Balance() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const { fundCategories, isLoading, error, totalBalanceEUR } = useFundCategories();
  const { privacyMode } = usePrivacyMode();

  if (error) return null;

  const amountColorClass = totalBalanceEUR >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

  // Memoize grouped and sorted categories to prevent recalculation on every render
  const sortedCategories = useMemo(() => {
    const grouped = fundCategories
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

    return Object.entries(grouped)
      .sort(([, a], [, b]) => b.totalEUR - a.totalEUR);
  }, [fundCategories]);

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(category)) {
        newExpanded.delete(category);
      } else {
        newExpanded.add(category);
      }
      return newExpanded;
    });
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 text-card-foreground rounded-xl border shadow-sm p-4 mb-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold m-0">Balance</h3>
        <div className="flex items-center gap-2">
          <div className={`text-lg font-semibold ${amountColorClass}`}>
            {isLoading ? (
              <Skeleton className="inline-block w-20 h-5 align-middle" />
            ) : (
              <PrivacyBlur blur={privacyMode}>
                €{formatAmountWithoutSymbol(Math.abs(totalBalanceEUR))}
              </PrivacyBlur>
            )}
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-accent hover:text-accent-foreground rounded transition-colors"
            aria-label={isExpanded ? "Collapse balance details" : "Expand balance details"}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-4">
          {(() => {
            if (isLoading) {
              return <BalanceSkeleton />;
            }
            if (fundCategories.length === 0) {
              return (
                <p className="text-sm text-muted-foreground text-center py-2">
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
                            className="w-full flex justify-between items-center py-2 px-2 hover:bg-muted/50 rounded transition-colors text-left"
                            onClick={() => toggleCategory(category)}
                            aria-expanded={isCategoryExpanded}
                            aria-controls={contentId}
                          >
                            <div className="flex items-center gap-2">
                              <span className="p-1 hover:bg-accent hover:text-accent-foreground rounded transition-colors" aria-hidden="true">
                                {isCategoryExpanded ? (
                                  <ChevronDown size={16} className="text-muted-foreground" />
                                ) : (
                                  <ChevronRight size={16} className="text-muted-foreground" />
                                )}
                              </span>
                              <div>
                                <div className="text-sm font-medium">
                                  {category}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {funds.length} fund{funds.length === 1 ? '' : 's'}
                                </div>
                              </div>
                            </div>
                            <div className="text-sm font-medium text-muted-foreground">
                              <PrivacyBlur blur={privacyMode}>
                                €{formatAmountWithoutSymbol(Math.abs(totalEUR))}
                              </PrivacyBlur>
                            </div>
                          </button>
                        );
                      })()}

                      {/* Individual Funds */}
                      {isCategoryExpanded && (
                        <div id={`category-${category.toLowerCase().replace(/[^a-z0-9_-]/gi, "-")}`} className="ml-6 space-y-1">
                          {sortedFunds.map((fund) => {
                            const CurrencyIcon = getCurrencyIcon(fund.currency);
                            return (
                              <div
                                key={fund.id}
                                className="flex justify-between items-center py-1 px-2 hover:bg-muted/50 rounded"
                              >
                                <div className="flex-1 flex items-center gap-2">
                                  <CurrencyIcon size={16} className="text-muted-foreground flex-shrink-0" />
                                  <div>
                                    <div className="text-sm">
                                      {fund.name}
                                    </div>
                                    {fund.description && (
                                      <div className="text-xs text-muted-foreground">
                                        {fund.description}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  <PrivacyBlur blur={privacyMode}>
                                    {formatCurrency(fund.current_amount || fund.amount, fund.currency)}
                                  </PrivacyBlur>
                                </div>
                              </div>
                            );
                          })}
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
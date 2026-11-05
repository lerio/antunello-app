"use client";

import { useMemo } from "react";
import { PrivacyBlur } from "@/components/ui/privacy-blur";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FundCategoryWithBalance,
  useFundCategories,
} from "@/hooks/useFundCategories";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { formatCurrency } from "@/utils/currency";
import { getCurrencyIcon } from "@/utils/currency-icons";

/**
 * Every active fund and its current balance, grouped by top-level category.
 *
 * The home card shows only the total; this is where the individual amounts
 * live.
 */
export default function FundList() {
  const { fundCategories, isLoading, error } = useFundCategories();
  const { privacyMode } = usePrivacyMode();

  const groups = useMemo(() => {
    const byCategory = new Map<string, FundCategoryWithBalance[]>();

    for (const fund of fundCategories) {
      if (!fund.is_active) continue;
      const category = fund.top_level_category || "Uncategorized";
      byCategory.set(category, [...(byCategory.get(category) ?? []), fund]);
    }

    return [...byCategory.entries()]
      .map(([name, funds]) => ({
        name,
        funds: funds.sort(
          (a, b) => b.current_eur_amount - a.current_eur_amount
        ),
        totalEUR: funds.reduce((sum, fund) => sum + fund.current_eur_amount, 0),
      }))
      .sort((a, b) => b.totalEUR - a.totalEUR);
  }, [fundCategories]);

  const totalEUR = groups.reduce((sum, group) => sum + group.totalEUR, 0);

  if (error) {
    return (
      <p className="text-sm text-muted-foreground">Couldn&apos;t load your funds.</p>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No fund categories configured. Add some in the admin settings.
      </p>
    );
  }

  return (
    <div className="space-y-4 tabular-nums">
      <div className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-gray-800 sm:p-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Total
        </p>
        <p className="mt-1 text-3xl font-semibold">
          <PrivacyBlur blur={privacyMode}>
            {formatCurrency(totalEUR, "EUR")}
          </PrivacyBlur>
        </p>
      </div>

      {groups.map((group) => (
        <div
          key={group.name}
          className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-gray-800 sm:p-6"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">
              {group.name}
              <span className="ml-2 font-normal text-muted-foreground">
                {group.funds.length} fund{group.funds.length === 1 ? "" : "s"}
              </span>
            </h3>
            <span className="text-sm font-medium text-muted-foreground">
              <PrivacyBlur blur={privacyMode}>
                {formatCurrency(group.totalEUR, "EUR")}
              </PrivacyBlur>
            </span>
          </div>

          <ul className="mt-2 divide-y divide-border">
            {group.funds.map((fund) => {
              const CurrencyIcon = getCurrencyIcon(fund.currency);
              return (
                <li
                  key={fund.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <CurrencyIcon
                      size={16}
                      className="flex-shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm">{fund.name}</div>
                      {fund.description && (
                        <div className="truncate text-xs text-muted-foreground">
                          {fund.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right text-sm">
                    <PrivacyBlur blur={privacyMode}>
                      {formatCurrency(fund.current_amount, fund.currency)}
                    </PrivacyBlur>
                    {fund.currency !== "EUR" && (
                      <div className="text-xs text-muted-foreground">
                        <PrivacyBlur blur={privacyMode}>
                          {formatCurrency(fund.current_eur_amount, "EUR")}
                        </PrivacyBlur>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

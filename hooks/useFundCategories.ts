"use client";

import useSWR from "swr";
import { createClient } from "@/utils/supabase/client";
import { FundCategory } from "@/types/database";
import { convertToEUR } from "@/utils/currency-conversion";

/**
 * A `FundCategory` extended with computed current balance information.
 */
export interface FundCategoryWithBalance extends FundCategory {
  /** The EUR-converted balance at calculation time (deprecated — prefer `current_eur_amount`). */
  eur_amount?: number;
  /** The current raw (non-converted) balance in the fund's native currency. */
  current_amount: number;
  /** The current balance converted to EUR. */
  current_eur_amount: number;
}

/** Row shape returned by the `get_fund_balances` RPC. */
type FundBalanceRow = {
  fund_id: string;
  balance: number;
};

/**
 * Hook to fetch all fund categories with their computed current balances.
 *
 * Fetches fund categories and their transaction deltas from the
 * `get_fund_balances` RPC (computed in SQL — no client-side scan of every
 * fund-linked transaction), then computes each fund's balance by starting
 * from its base amount and applying:
 *  - Regular income/expense transactions (add/subtract amount).
 *  - Money transfers (subtract from source fund, add to target fund).
 *
 * Non-EUR fund balances are converted to EUR using the Frankfurter API
 * (via `convertToEUR`). The total balance across all funds is also computed.
 *
 * @returns An object containing:
 *  - `fundCategories`: Array of `FundCategoryWithBalance` objects (defaults to `[]`).
 *  - `totalBalanceEUR`: The sum of all fund balances in EUR.
 *  - `isLoading`: `true` while the initial fetch is in-flight.
 *  - `error`: Any fetch error, or `undefined`.
 *  - `mutate`: SWR mutate function for manual cache invalidation.
 */
export function useFundCategories() {
  const supabase = createClient();

  const { data, error, isLoading, mutate } = useSWR(
    "fund-categories",
    async () => {
      // Fetch fund categories
      const { data: fundCategories, error: fundError } = await supabase
        .from("fund_categories")
        .select("*")
        .order("order_index", { ascending: true });

      if (fundError) throw fundError;

      // Transaction deltas are computed in SQL via the get_fund_balances RPC.
      // Local session read (no network round trip) — getUser() would re-hit auth.
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      const balanceByFundId = new Map<string, number>();
      if (userId) {
        const { data: fundBalances, error: rpcError } = await supabase.rpc(
          "get_fund_balances",
          { p_user_id: userId }
        );

        if (rpcError) throw rpcError;

        for (const row of (fundBalances ?? []) as FundBalanceRow[]) {
          balanceByFundId.set(row.fund_id, Number(row.balance) || 0);
        }
      }

      // Start from the fund's manual base amount and add the transaction delta.
      const fundsWithBalances = fundCategories.map((fund) => {
        const currentAmount =
          Number(fund.amount) + (balanceByFundId.get(fund.id) ?? 0);

        return {
          fund,
          currentAmount,
        };
      });

      // Batch convert all non-EUR funds to EUR using Promise.all
      const today = new Date().toISOString().split("T")[0];
      const nonEurFunds = fundsWithBalances.filter((f) => f.fund.currency !== "EUR");

      const conversions = await Promise.all(
        nonEurFunds.map((f) =>
          convertToEUR(f.currentAmount, f.fund.currency, today)
        )
      );

      // Build conversion lookup map
      const eurAmountByFundId = new Map<string, number>();
      nonEurFunds.forEach((f, i) => {
        eurAmountByFundId.set(f.fund.id, conversions[i]?.eurAmount || 0);
      });

      // Build final result
      const fundCategoriesWithBalance: FundCategoryWithBalance[] = fundsWithBalances.map(
        ({ fund, currentAmount }) => {
          const currentEurAmount =
            fund.currency === "EUR"
              ? currentAmount
              : eurAmountByFundId.get(fund.id) || 0;

          return {
            ...fund,
            eur_amount: currentEurAmount,
            current_amount: currentAmount,
            current_eur_amount: currentEurAmount,
          };
        }
      );

      return fundCategoriesWithBalance;
    }
  );

  const totalBalanceEUR =
    data?.reduce((total, fund) => total + (fund.current_eur_amount || 0), 0) || 0;

  return {
    fundCategories: data || [],
    totalBalanceEUR,
    isLoading,
    error,
    mutate,
  };
}

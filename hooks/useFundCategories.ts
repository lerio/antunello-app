"use client";

import useSWR from "swr";
import { createClient } from "@/utils/supabase/client";
import { FundCategory, Transaction } from "@/types/database";
import { convertToEUR } from "@/utils/currency-conversion";

export interface FundCategoryWithBalance extends FundCategory {
  eur_amount?: number;
  current_amount: number;
  current_eur_amount: number;
}

// Minimal transaction fields needed for balance calculation
type BalanceTransaction = Pick<
  Transaction,
  | "id"
  | "fund_category_id"
  | "target_fund_category_id"
  | "amount"
  | "currency"
  | "date"
  | "type"
  | "is_money_transfer"
>;

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

      // Fetch only required fields for balance calculation (reduces payload)
      const { data: transactions, error: txError } = await supabase
        .from("transactions")
        .select(
          "id, fund_category_id, target_fund_category_id, amount, currency, date, type, is_money_transfer"
        )
        .or("fund_category_id.not.is.null,target_fund_category_id.not.is.null");

      if (txError) throw txError;

      // Single-pass grouping: Map fund ID -> transactions affecting that fund
      const txByFund = new Map<string, BalanceTransaction[]>();
      for (const tx of (transactions as BalanceTransaction[]) || []) {
        if (tx.fund_category_id) {
          const arr = txByFund.get(tx.fund_category_id) || [];
          arr.push(tx);
          txByFund.set(tx.fund_category_id, arr);
        }
        if (tx.target_fund_category_id && tx.target_fund_category_id !== tx.fund_category_id) {
          const arr = txByFund.get(tx.target_fund_category_id) || [];
          arr.push(tx);
          txByFund.set(tx.target_fund_category_id, arr);
        }
      }

      // Calculate balances synchronously (no awaits in loop)
      const fundsWithBalances = fundCategories.map((fund) => {
        const fundTxs = txByFund.get(fund.id) || [];
        let currentAmount = fund.amount;

        for (const tx of fundTxs) {
          if (tx.is_money_transfer) {
            if (tx.fund_category_id === fund.id) {
              // This fund is SOURCE - subtract amount
              // For cross-currency transfers, amount is in target currency
              // We subtract as-is since exact conversion would require async
              currentAmount -= tx.amount;
            } else if (tx.target_fund_category_id === fund.id) {
              // This fund is TARGET - add amount
              currentAmount += tx.amount;
            }
          } else {
            // Regular transaction: income adds, expense subtracts
            if (tx.type === "income") {
              currentAmount += tx.amount;
            } else if (tx.type === "expense") {
              currentAmount -= tx.amount;
            }
          }
        }

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

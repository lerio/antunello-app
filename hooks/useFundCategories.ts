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

      // Fetch transactions linked to fund categories
      const { data: transactions, error: txError } = await supabase
        .from("transactions")
        .select("*")
        .not("fund_category_id", "is", null);

      if (txError) throw txError;


      // Calculate current balance for each fund category
      const fundCategoriesWithBalance: FundCategoryWithBalance[] = await Promise.all(
        fundCategories.map(async (fund) => {
          // Filter transactions for this fund
          const fundTransactions = transactions?.filter(
            (tx: Transaction) => tx.fund_category_id === fund.id
          ) || [];

          // Calculate current amount (base amount + transaction adjustments)
          let currentAmount = fund.amount;

          fundTransactions.forEach((tx: Transaction) => {
            if (tx.type === "income") {
              currentAmount += tx.amount;
            } else if (tx.type === "expense") {
              currentAmount -= tx.amount;
            }
          });

          // Convert current amount to EUR
          let currentEurAmount = 0;
          if (fund.currency === "EUR") {
            currentEurAmount = currentAmount;
          } else {
            // Use today's date for conversion (current balance)
            const today = new Date().toISOString().split("T")[0];
            const conversion = await convertToEUR(currentAmount, fund.currency, today);
            currentEurAmount = conversion?.eurAmount || 0;
          }

          return {
            ...fund,
            eur_amount: currentEurAmount, // For backward compatibility
            current_amount: currentAmount,
            current_eur_amount: currentEurAmount,
          };
        })
      );

      return fundCategoriesWithBalance;
    }
  );

  const totalBalanceEUR = data?.reduce((total, fund) => total + (fund.current_eur_amount || 0), 0) || 0;

  return {
    fundCategories: data || [],
    totalBalanceEUR,
    isLoading,
    error,
    mutate,
  };
}
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

      // Fetch transactions linked to fund categories (source or target)
      const { data: transactions, error: txError } = await supabase
        .from("transactions")
        .select("*")
        .or("fund_category_id.not.is.null,target_fund_category_id.not.is.null");

      if (txError) throw txError;


      // Calculate current balance for each fund category
      const fundCategoriesWithBalance: FundCategoryWithBalance[] = await Promise.all(
        fundCategories.map(async (fund) => {
          // Filter transactions for this fund (as source OR target)
          const fundTransactions = transactions?.filter(
            (tx: Transaction) =>
              tx.fund_category_id === fund.id ||
              tx.target_fund_category_id === fund.id
          ) || [];

          // Calculate current amount (base amount + transaction adjustments)
          let currentAmount = fund.amount;

          for (const tx of fundTransactions) {
            if (tx.is_money_transfer) {
              // Money transfers: subtract from source, add to target
              if (tx.fund_category_id === fund.id) {
                // This fund is SOURCE - subtract amount
                // Amount is in target currency, need to convert to fund currency
                if (tx.currency === fund.currency) {
                  currentAmount -= tx.amount;
                } else {
                  // Convert amount from transaction currency to fund currency
                  const eurConversion = await convertToEUR(tx.amount, tx.currency, tx.date.split('T')[0]);
                  if (eurConversion && fund.currency === 'EUR') {
                    currentAmount -= eurConversion.eurAmount;
                  } else if (eurConversion) {
                    // Need to convert from EUR to fund currency
                    // For simplicity, use the amount as-is (fallback)
                    currentAmount -= tx.amount;
                  } else {
                    currentAmount -= tx.amount; // Fallback
                  }
                }
              } else if (tx.target_fund_category_id === fund.id) {
                // This fund is TARGET - add amount (already in target currency)
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
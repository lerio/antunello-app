"use client";

import useSWR from "swr";
import { createClient } from "@/utils/supabase/client";
import { FundCategory } from "@/types/database";
import { convertToEUR } from "@/utils/currency-conversion";

interface FundCategoryWithEUR extends FundCategory {
  eur_amount?: number;
}

export function useFundCategories() {
  const supabase = createClient();

  const { data, error, isLoading, mutate } = useSWR(
    "fund-categories",
    async () => {
      const { data: fundCategories, error } = await supabase
        .from("fund_categories")
        .select("*")
        .order("order_index", { ascending: true });

      if (error) throw error;

      // Convert amounts to EUR for total calculation
      const fundCategoriesWithEUR: FundCategoryWithEUR[] = await Promise.all(
        fundCategories.map(async (fund) => {
          if (fund.currency === "EUR") {
            return { ...fund, eur_amount: fund.amount };
          }

          // Use today's date for conversion (current balance)
          const today = new Date().toISOString().split("T")[0];
          const conversion = await convertToEUR(fund.amount, fund.currency, today);

          return {
            ...fund,
            eur_amount: conversion?.eurAmount || 0,
          };
        })
      );

      return fundCategoriesWithEUR;
    }
  );

  const totalBalanceEUR = data?.reduce((total, fund) => total + (fund.eur_amount || 0), 0) || 0;

  return {
    fundCategories: data || [],
    totalBalanceEUR,
    isLoading,
    error,
    mutate,
  };
}
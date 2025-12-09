-- Migration: Add composite indexes for performance optimization
-- Date: 2024-12-09
-- Purpose: Optimize common query patterns for transactions table
-- Note: CONCURRENTLY removed for Supabase SQL editor compatibility

-- Index for fetching user transactions ordered by date (most common query)
-- Used by: useTransactionsOptimized, useYearTransactions, transaction-fetcher
CREATE INDEX IF NOT EXISTS idx_transactions_user_date
  ON transactions(user_id, date DESC);

-- Index for filtering transactions by hide_from_totals
-- Used by: transaction summaries, overall totals calculations
CREATE INDEX IF NOT EXISTS idx_transactions_user_hide
  ON transactions(user_id, hide_from_totals)
  WHERE hide_from_totals = true;

-- Index for filtering money transfer transactions
-- Used by: useFundCategories balance calculations
CREATE INDEX IF NOT EXISTS idx_transactions_user_transfer
  ON transactions(user_id, is_money_transfer)
  WHERE is_money_transfer = true;

-- Index for fund category lookups (source fund)
-- Used by: useFundCategories, fund balance calculations
CREATE INDEX IF NOT EXISTS idx_transactions_fund_category
  ON transactions(fund_category_id)
  WHERE fund_category_id IS NOT NULL;

-- Index for fund category lookups (target fund for transfers)
-- Used by: useFundCategories, money transfer balance calculations
CREATE INDEX IF NOT EXISTS idx_transactions_target_fund
  ON transactions(target_fund_category_id)
  WHERE target_fund_category_id IS NOT NULL;

-- Composite index for fund-related transaction queries
-- Optimizes the OR query pattern: fund_category_id OR target_fund_category_id
CREATE INDEX IF NOT EXISTS idx_transactions_any_fund
  ON transactions(user_id, fund_category_id, target_fund_category_id)
  WHERE fund_category_id IS NOT NULL OR target_fund_category_id IS NOT NULL;

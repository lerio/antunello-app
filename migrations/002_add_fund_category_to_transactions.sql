-- Migration: Add fund_category_id column to transactions table
-- Date: 2025-10-28
-- Description: Links transactions to fund categories for balance tracking

-- Add fund_category_id column to transactions table
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS fund_category_id UUID REFERENCES fund_categories(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_fund_category_id
ON transactions(fund_category_id);

-- Update existing transactions to have NULL fund_category_id
UPDATE transactions SET fund_category_id = NULL WHERE fund_category_id IS NOT NULL;
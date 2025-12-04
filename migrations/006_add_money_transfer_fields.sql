-- Migration: Add money transfer support to transactions
-- Date: 2025-12-03
-- Description: Add fields to support fund-to-fund money transfers

-- Add is_money_transfer flag
ALTER TABLE transactions
ADD COLUMN is_money_transfer BOOLEAN DEFAULT FALSE NOT NULL;

-- Add target_fund_category_id for transfers
ALTER TABLE transactions
ADD COLUMN target_fund_category_id UUID REFERENCES fund_categories(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_is_money_transfer
ON transactions(user_id, is_money_transfer) WHERE is_money_transfer = true;

CREATE INDEX IF NOT EXISTS idx_transactions_target_fund_category_id
ON transactions(target_fund_category_id) WHERE target_fund_category_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN transactions.is_money_transfer IS 'True when this transaction represents a fund-to-fund transfer';
COMMENT ON COLUMN transactions.target_fund_category_id IS 'Destination fund for money transfers. When set, fund_category_id is the source fund. Amount is stored in target fund currency.';

-- Add check constraint to ensure money transfers have both source and target
ALTER TABLE transactions
ADD CONSTRAINT check_money_transfer_fields CHECK (
  (is_money_transfer = false) OR
  (is_money_transfer = true AND
   fund_category_id IS NOT NULL AND
   target_fund_category_id IS NOT NULL AND
   fund_category_id != target_fund_category_id)
);

-- Note: For money transfers:
-- - type should be 'expense' (arbitrary choice for consistency)
-- - main_category will be 'Money Transfer'
-- - sub_category will be 'Money Transfer'
-- - title will be auto-generated as "Source ➡️ Target"
-- - hide_from_totals is user-configurable (money transfers are excluded from totals at query level)
-- - amount is stored in target fund's currency

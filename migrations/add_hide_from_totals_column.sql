-- Migration: Add hide_from_totals column to transactions table
-- Date: 2025-08-14
-- Description: Add boolean column to allow transactions to be excluded from total calculations

-- Add the hide_from_totals column to the transactions table
ALTER TABLE transactions 
ADD COLUMN hide_from_totals BOOLEAN DEFAULT FALSE;

-- Add a comment to document the column purpose
COMMENT ON COLUMN transactions.hide_from_totals IS 'When true, this transaction is excluded from daily and monthly total calculations but still visible in the transaction list';

-- Create an index for performance when filtering by this column
CREATE INDEX idx_transactions_hide_from_totals ON transactions(hide_from_totals) WHERE hide_from_totals = true;

-- Update RLS policies if needed (transactions should be accessible by the owner regardless of hide_from_totals value)
-- No changes needed to existing policies as this is just an additional data field
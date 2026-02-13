-- Migration: Add indexes for API hot paths
-- Date: 2026-02-13
-- Purpose:
--   1) Speed up integration config lookups by user_id + account_id
--   2) Speed up pending transaction lists (status + created_at, scoped by user)
--   3) Help overall totals aggregation by reducing heap access for per-user scans

-- Used by:
-- - app/api/enable-banking/update-mapping/route.ts
-- - app/api/cron/sync/route.ts
-- - hooks/usePendingTransactions.ts
-- - app/api/overall-totals/route.ts (RPC get_overall_total_eur)

-- 1) Integration config lookups by user/account
create index if not exists idx_integration_configs_user_account
  on integration_configs(user_id, account_id);

-- 2) Pending transactions list for the current user with newest-first ordering
create index if not exists idx_pending_transactions_user_status_created
  on pending_transactions(user_id, status, created_at desc);

-- 3) Covering index for overall totals aggregation
-- Existing idx_transactions_user_date helps date-ordered reads, but totals scans all rows for a user.
-- Including amount columns can reduce heap lookups for sum calculations.
create index if not exists idx_transactions_user_totals_covering
  on transactions(user_id)
  include (type, eur_amount, amount);

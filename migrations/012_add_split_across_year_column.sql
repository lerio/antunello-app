-- Migration: Add split-across-year flag to transactions
-- Date: 2026-02-14
-- Purpose: allow a transaction to be displayed as 12 monthly split instances in UI

alter table transactions
add column if not exists split_across_year boolean not null default false;

create index if not exists idx_transactions_user_split_year
  on transactions(user_id, split_across_year, date desc)
  where split_across_year = true;

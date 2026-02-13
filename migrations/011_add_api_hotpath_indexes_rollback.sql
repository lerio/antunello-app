-- Rollback for: 011_add_api_hotpath_indexes.sql
-- Safe to run if you need to revert index changes.

drop index if exists idx_transactions_user_totals_covering;
drop index if exists idx_pending_transactions_user_status_created;
drop index if exists idx_integration_configs_user_account;

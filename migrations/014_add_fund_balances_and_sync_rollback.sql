-- 014_add_fund_balances_and_sync_rollback.sql
--
-- Removes the RPC, trigger, and index added by
-- 014_add_fund_balances_and_sync.sql. The client change in
-- hooks/useFundCategories.ts must be reverted together with this rollback.

drop function if exists public.get_fund_balances(uuid);
drop trigger if exists update_transactions_updated_at on public.transactions;
drop index if exists public.idx_transactions_user_updated_at;

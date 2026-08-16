-- 013_add_transactions_rls_policies_rollback.sql
--
-- Removes the user-scoped policies added by 013_add_transactions_rls_policies.sql.
-- Warning: running this alone reverts transactions to the previous state in
-- which SELECT was not user-scoped (the anon key can read all rows again).

drop policy if exists "transactions_select_own" on public.transactions;
drop policy if exists "transactions_insert_own" on public.transactions;
drop policy if exists "transactions_update_own" on public.transactions;
drop policy if exists "transactions_delete_own" on public.transactions;

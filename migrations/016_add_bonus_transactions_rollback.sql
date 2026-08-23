-- 016_add_bonus_transactions_rollback.sql
--
-- Reverts 016: restores the original 013 update/delete policies, drops the
-- bonus columns, constraints and indexes.

-- 1. Restore the original user-scoped update/delete policies from 013.
drop policy if exists transactions_update_own on public.transactions;
drop policy if exists transactions_delete_own on public.transactions;

create policy "transactions_update_own" on public.transactions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "transactions_delete_own" on public.transactions
  for delete
  using (auth.uid() = user_id);

-- 2. Drop constraints and indexes.
alter table public.transactions
  drop constraint if exists fk_transactions_parent_same_user;

drop index if exists idx_transactions_parent_transaction_id;
drop index if exists idx_transactions_id_user;

alter table public.transactions
  drop constraint if exists check_bonus_parent;

-- 3. Drop columns.
alter table public.transactions
  drop column if exists bonus_kind,
  drop column if exists parent_transaction_id;

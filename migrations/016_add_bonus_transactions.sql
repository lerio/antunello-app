-- 016_add_bonus_transactions.sql
--
-- Purpose: Add linked "bonus" transactions for Trade Republic saveback and
-- round-up. Each bonus row references its parent card transaction and is
-- unmodifiable/undeletable by clients; it is removed automatically when the
-- parent is deleted.
--
-- Design notes:
--  - `parent_transaction_id` + `bonus_kind` are new nullable columns; the
--    CHECK ensures a bonus row always has a parent and vice versa.
--  - The composite FK (parent_transaction_id, user_id) -> (id, user_id)
--    guarantees the parent belongs to the same user; ON DELETE CASCADE
--    removes bonus rows with their parent (RI cascade triggers bypass RLS,
--    including the FORCE RLS enabled in 013).
--  - The update/delete policies are recreated with `bonus_kind is null` so
--    clients cannot modify or remove bonus rows. Note: PostgREST reports
--    success with zero affected rows when RLS blocks a statement, so the app
--    also guards in the mutation hook.
--  - Select/insert policies are unchanged: bonus rows are visible to their
--    owner and are inserted with the owner's user_id at accept time.

-- 1. New columns
alter table public.transactions
  add column if not exists parent_transaction_id uuid,
  add column if not exists bonus_kind text
    check (bonus_kind is null or bonus_kind in ('saveback', 'round_up'));

-- 2. Bonus rows must reference a parent; non-bonus rows must not.
--    (Postgres has no ADD CONSTRAINT IF NOT EXISTS — drop first for
--    idempotent re-runs.)
alter table public.transactions
  drop constraint if exists check_bonus_parent;

alter table public.transactions
  add constraint check_bonus_parent
  check (parent_transaction_id is not null or bonus_kind is null);

-- 3. Same-user composite FK with delete cascade.
--    id is the PK, so (id, user_id) is unique; the unique index satisfies
--    the referenced-column requirement of the composite FK.
create unique index if not exists idx_transactions_id_user
  on public.transactions (id, user_id);

alter table public.transactions
  drop constraint if exists fk_transactions_parent_same_user;

alter table public.transactions
  add constraint fk_transactions_parent_same_user
  foreign key (parent_transaction_id, user_id)
  references public.transactions (id, user_id)
  on delete cascade;

-- 4. Lookup index for parent -> children (used by queries and the cascade).
create index if not exists idx_transactions_parent_transaction_id
  on public.transactions (parent_transaction_id)
  where parent_transaction_id is not null;

-- 5. RLS hardening: bonus rows cannot be updated or deleted by clients.
--    (Parent deletion still cascades: RI triggers bypass RLS.)
drop policy if exists transactions_update_own on public.transactions;
drop policy if exists transactions_delete_own on public.transactions;

create policy "transactions_update_own" on public.transactions
  for update
  using (auth.uid() = user_id and bonus_kind is null)
  with check (auth.uid() = user_id and bonus_kind is null);

create policy "transactions_delete_own" on public.transactions
  for delete
  using (auth.uid() = user_id and bonus_kind is null);

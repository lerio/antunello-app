-- 013_add_transactions_rls_policies.sql
--
-- Purpose: Close an RLS gap on public.transactions that allowed the public
-- anon key to read every user's transactions without authentication
-- (verified 2026-08-16: GET /rest/v1/transactions with only the anon
-- apikey returned all rows). Writes were already blocked by RLS; this adds
-- user-scoped SELECT/INSERT/UPDATE/DELETE policies and drops any pre-existing
-- (likely permissive, dashboard-created) policies on the table.
--
-- Why this is safe for the app:
--  - Service role operations (admin CSV import, data management, Enable
--    Banking sync) bypass RLS and are unaffected.
--  - RPCs `get_overall_total_eur` and `get_balance_before_date` are SECURITY
--    INVOKER and are always called with the caller's own user_id, so they
--    keep working under the new SELECT policy.
--  - Realtime postgres_changes respects the SELECT policy, so the user still
--    receives their own row events.
--  - The title-pattern maintenance trigger inserts rows for the same
--    user_id as the triggering transaction, so it keeps working.

-- 1. Enable and force RLS.
--    FORCE subjects even the table owner (postgres) to the policies.
--    Note: the Supabase SQL editor runs as postgres, so plain SELECTs there
--    will return no rows after this; the dashboard table editor uses the
--    service role and is unaffected.
alter table public.transactions enable row level security;
alter table public.transactions force row level security;

-- 2. Drop ALL existing policies on transactions so a permissive leftover
--    cannot OR-in and re-open the leak (permissive policies are additive).
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'transactions'
  loop
    execute format('drop policy if exists %I on public.transactions', pol.policyname);
  end loop;
end $$;

-- 3. User-scoped policies.
create policy "transactions_select_own" on public.transactions
  for select
  using (auth.uid() = user_id);

create policy "transactions_insert_own" on public.transactions
  for insert
  with check (auth.uid() = user_id);

create policy "transactions_update_own" on public.transactions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "transactions_delete_own" on public.transactions
  for delete
  using (auth.uid() = user_id);

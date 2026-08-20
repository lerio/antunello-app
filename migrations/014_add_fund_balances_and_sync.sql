-- 014_add_fund_balances_and_sync.sql
--
-- Purpose: speed up page loads and enable cross-device change detection.
--  - idx_transactions_user_updated_at: supports the background sync check
--    (latest updated_at + exact count for one user), which previously ran
--    without an index on updated_at.
--  - update_transactions_updated_at trigger: app UPDATEs never bumped
--    transactions.updated_at (no trigger existed), so edits made on another
--    device were invisible to the sync diff (row count doesn't change on
--    edit).
--  - get_fund_balances RPC: computes per-fund raw-currency transaction deltas
--    in SQL, replacing an unbounded client-side fetch of every fund-linked
--    transaction on the home, transactions, and settings pages.

-- 1. Index for the background sync check.
create index if not exists idx_transactions_user_updated_at
  on public.transactions(user_id, updated_at desc);

comment on index public.idx_transactions_user_updated_at is
  'Supports the background sync latest-updated_at check and count queries';

-- 2. updated_at trigger on transactions.
--    update_updated_at_column() already exists (migration 001, used by the
--    fund_categories trigger) and sets NEW.updated_at = NOW().
drop trigger if exists update_transactions_updated_at on public.transactions;
create trigger update_transactions_updated_at
  before update on public.transactions
  for each row
  execute function update_updated_at_column();

-- 3. Per-fund raw-currency balance RPC.
--
-- SECURITY INVOKER (default, like get_balance_before_date): the inner queries
-- run under the caller and are scoped by the RLS policies from migration 013.
--
-- Semantics are a verbatim port of the client loop in
-- hooks/useFundCategories.ts:
--  - money transfer: source fund subtracts, target fund adds (amount is
--    stored in the target currency; same "subtract as-is" behavior);
--  - regular transaction: income adds, expense subtracts, applied to both
--    fund_category_id and target_fund_category_id when set;
--  - no hide_from_totals filter and no date filter (the client has none);
--  - the fund's initial amount is NOT included — the client adds it.
-- Source == target is impossible (CHECK constraint from migration 006).
create or replace function public.get_fund_balances(p_user_id uuid)
returns table (fund_id uuid, balance numeric)
language sql
stable
as $$
  select
    f.id as fund_id,
    coalesce(sum(
      case
        when t.is_money_transfer is true and t.fund_category_id = f.id then -t.amount
        when t.is_money_transfer is true and t.target_fund_category_id = f.id then t.amount
        when t.is_money_transfer is not true and t.type = 'income'
          and (t.fund_category_id = f.id or t.target_fund_category_id = f.id) then t.amount
        when t.is_money_transfer is not true and t.type = 'expense'
          and (t.fund_category_id = f.id or t.target_fund_category_id = f.id) then -t.amount
        else 0
      end
    ), 0)::numeric as balance
  from public.fund_categories f
  left join public.transactions t
    on t.user_id = f.user_id
   and (t.fund_category_id = f.id or t.target_fund_category_id = f.id)
  where f.user_id = p_user_id
  group by f.id
$$;

comment on function public.get_fund_balances(uuid) is
  'Returns the raw-currency transaction delta per fund (excludes the fund''s initial amount); the client adds fund.amount and converts to EUR with today''s rate';

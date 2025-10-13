-- Migration: Create RPC to compute overall totals per currency and overall EUR total
-- Date: 2025-10-13
-- Description: Defines get_overall_totals(user_id) to aggregate totals efficiently on the DB

-- Note: run this SQL in your Supabase project's SQL editor or via your preferred migration system.
-- It is idempotent: we drop and recreate the function to apply updates safely.

create or replace function public.get_overall_totals(p_user_id uuid)
returns table (
  currency text,
  total numeric,
  eur_total numeric,
  overall_eur_total numeric
)
language sql
stable
as $$
  with tx as (
    select
      t.currency,
      -- Signed amounts: +income, -expense in original currency
      sum(case when t.type = 'income' then t.amount else -t.amount end) as total,
      -- Signed amounts in EUR (uses eur_amount when present, falls back to amount)
      sum(case when t.type = 'income' then coalesce(t.eur_amount, t.amount)
               else -coalesce(t.eur_amount, t.amount) end) as eur_total
    from public.transactions t
    where t.user_id = p_user_id
    group by t.currency
  )
  select
    tx.currency,
    tx.total,
    tx.eur_total,
    (select sum(eur_total) from tx) as overall_eur_total
  from tx
  order by tx.currency asc;
$$;

comment on function public.get_overall_totals(uuid) is 'Returns per-currency signed totals and overall EUR total for a user.';

-- Helpful index (if not already present) to accelerate aggregation by user + currency
create index if not exists idx_transactions_user_currency on public.transactions(user_id, currency);

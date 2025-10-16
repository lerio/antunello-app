-- Migration: Replace per-currency totals RPC with overall-eur-only RPC
-- Date: 2025-10-16
-- Description: Drop get_overall_totals and its index; create get_overall_total_eur(p_user_id)

-- Drop old per-currency function if present
drop function if exists public.get_overall_totals(uuid);

-- Drop index introduced for the per-currency aggregation (no longer needed)
drop index if exists public.idx_transactions_user_currency;

-- Create simplified RPC returning only the overall EUR total for the user
create or replace function public.get_overall_total_eur(p_user_id uuid)
returns numeric
language sql
stable
as $$
  select coalesce(sum(
    case when t.type = 'income'
      then coalesce(t.eur_amount, t.amount)
      else -coalesce(t.eur_amount, t.amount)
    end
  ), 0) as overall_eur_total
  from public.transactions t
  where t.user_id = p_user_id
$$;

comment on function public.get_overall_total_eur(uuid) is 'Returns overall signed EUR total for a user.';

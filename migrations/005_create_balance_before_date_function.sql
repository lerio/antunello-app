-- Migration: Create get_balance_before_date RPC function and user_date index
-- Date: 2025-12-02
-- Description: Add RPC function to efficiently calculate starting balance before a date,
--              and composite index on (user_id, date) for optimal performance

-- Create composite index for efficient date range queries and RPC function
-- This index supports both .gte('date', startDate) queries and the RPC function
create index if not exists idx_transactions_user_date
on public.transactions(user_id, date desc);

comment on index public.idx_transactions_user_date is 'Composite index for efficient user transaction queries by date range';

-- Create RPC function to calculate balance before a specific date
-- This replaces client-side iteration through all prior transactions
create or replace function public.get_balance_before_date(
  p_user_id uuid,
  p_date date,
  p_include_hidden boolean default false
)
returns numeric
language sql
stable
as $$
  select coalesce(sum(
    case when t.type = 'income'
      then coalesce(t.eur_amount, t.amount)
      else -coalesce(t.eur_amount, t.amount)
    end
  ), 0) as balance_before_date
  from public.transactions t
  where t.user_id = p_user_id
    and t.date < p_date
    and (p_include_hidden = true or t.hide_from_totals = false)
$$;

comment on function public.get_balance_before_date(uuid, date, boolean) is 'Returns cumulative EUR balance for a user before a specific date, optionally excluding hidden transactions';

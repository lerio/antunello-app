-- 020_month_pace_net_to_date.sql
--
-- Gives the Home "on track" card the month-to-date net and the same figure for
-- the previous month, so the comparison row can move off the transactions page.
--
-- Three new columns:
--   income_to_date          income received so far this month
--   net_to_date             income_to_date - spent_to_date
--   prev_month_net_to_day   the previous month's net, measured to the same day
--                           of month (clamped when that month is shorter)
--
-- Hidden rows stay excluded, matching spent_to_date on the same card — the
-- "vs last month" line sits directly beneath "Spent so far", and two different
-- hiding rules on adjacent lines would be indefensible. (The net worth series
-- takes the opposite view, because a balance must be true; see 019.)
--
-- The return type changes, so the function must be dropped rather than
-- replaced. Rollback: re-run 018.

drop function if exists public.get_month_pace(uuid, date, text);

create or replace function public.get_month_pace(
  p_user_id uuid,
  p_month date,
  p_tz text default 'UTC'
)
returns table (
  month_start date,
  as_of_date date,
  spent_to_date numeric,
  income_to_date numeric,
  net_to_date numeric,
  prev_month_net_to_day numeric,
  typical_spent_to_date numeric,
  projected_expenses numeric,
  usual_income numeric,
  projected_net numeric,
  prior_30d_net numeric
)
language sql
stable
as $$
with v as (
  select
    date_trunc('month', p_month)::date as month_start,
    extract(day from as_of_date)::int as as_of_day,
    as_of_date
  from (
    select least(
      (now() at time zone p_tz)::date,
      (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date
    ) as as_of_date
  ) bounds
),
instances as (
  -- Regular transactions: one instance, on their own local date.
  select
    (t.date at time zone p_tz)::date as instance_date,
    t.type::text as type,
    coalesce(t.eur_amount, t.amount) as eur
  from public.transactions t
  where t.user_id = p_user_id
    and t.is_money_transfer = false
    and t.hide_from_totals is not true
    and t.split_across_year = false
    and coalesce(t.eur_amount, t.amount) is not null

  union all

  -- Split sources: twelve monthly instances, remainder in the source month,
  -- each dated on the source's local day-of-month clamped to month end.
  select
    least(
      (date_trunc('month', s.date at time zone p_tz) + (g.month_offset || ' month')::interval)::date
        + (extract(day from (s.date at time zone p_tz))::int - 1),
      (date_trunc('month', s.date at time zone p_tz) + ((g.month_offset + 1) || ' month')::interval
        - interval '1 day')::date
    ) as instance_date,
    s.type::text as type,
    case
      when g.month_offset = 0 then s.eur_amount - 11 * round(s.eur_amount / 12.0, 2)
      else round(s.eur_amount / 12.0, 2)
    end as eur
  from public.transactions s
  cross join generate_series(0, 11) as g(month_offset)
  where s.user_id = p_user_id
    and s.is_money_transfer = false
    and s.hide_from_totals is not true
    and s.split_across_year = true
    and s.eur_amount is not null
),
recent as (
  -- The trailing 12 complete months, carrying both the month's total (the
  -- level) and the amount completed by the same day of month (the shape).
  select
    date_trunc('month', i.instance_date)::date as month_start,
    i.type,
    sum(i.eur) as total,
    sum(case when extract(day from i.instance_date)::int <= v.as_of_day
             then i.eur else 0 end) as thru
  from instances i, v
  where i.instance_date >= (v.month_start - interval '12 months')::date
    and i.instance_date < v.month_start
  group by 1, 2
),
level as (
  select
    (select percentile_cont(0.5) within group (order by total)
     from recent where type = 'expense')::numeric as usual_expenses,
    (select percentile_cont(0.5) within group (order by total)
     from recent where type = 'income')::numeric as usual_income
),
shape as (
  select (percentile_cont(0.5) within group (order by thru / total))::numeric as frac
  from recent
  where type = 'expense' and total > 0
),
to_date_totals as (
  select
    coalesce(sum(case when i.type = 'expense' then i.eur else 0 end), 0)::numeric as spent_to_date,
    coalesce(sum(case when i.type = 'income' then i.eur else 0 end), 0)::numeric as income_to_date
  from instances i, v
  where i.instance_date between v.month_start and v.as_of_date
),
prev_month as (
  -- The same day of the previous month: that month's first day plus as many
  -- days as have elapsed here, clamped to the previous month's own end.
  select coalesce(sum(
    case when i.type = 'income' then i.eur else -i.eur end
  ), 0)::numeric as net_to_day
  from instances i, v
  where i.instance_date between (v.month_start - interval '1 month')::date
    and least(
      (v.month_start - interval '1 month')::date + (v.as_of_day - 1),
      (v.month_start - interval '1 day')::date
    )
),
prior30 as (
  select coalesce(sum(
    case when i.type = 'income' then i.eur else -i.eur end
  ), 0)::numeric as prior_30d_net
  from instances i, v
  where i.instance_date between (v.as_of_date - 29) and v.as_of_date
)
select
  v.month_start,
  v.as_of_date,
  t.spent_to_date,
  t.income_to_date,
  (t.income_to_date - t.spent_to_date)::numeric as net_to_date,
  pm.net_to_day as prev_month_net_to_day,
  (l.usual_expenses * sh.frac)::numeric as typical_spent_to_date,
  case when sh.frac > 0 then (t.spent_to_date / sh.frac)::numeric end as projected_expenses,
  l.usual_income,
  case when sh.frac > 0
       then (l.usual_income - t.spent_to_date / sh.frac)::numeric end as projected_net,
  p.prior_30d_net
from v, to_date_totals t, prev_month pm, level l, shape sh, prior30 p
$$;

comment on function public.get_month_pace(uuid, date, text) is
  'Month-to-date spending, income and net vs a typical month at the same point and vs the previous month to the same day. Level and intra-month shape are medians over the trailing 12 complete months. Excludes money transfers and hidden rows; dates are attributed in p_tz. Null projections mean there is not enough history yet.';

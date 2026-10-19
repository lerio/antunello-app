-- 018_fix_month_pace_shape_and_timezone.sql
--
-- Supersedes two of 017's assumptions, both caught by comparing the first
-- Home render against the real ledger:
--
-- 1. Intra-month shape from the trailing 12 complete months, not all history.
--    The shape step-changed in October 2025 (~0.10 -> ~0.39 of a month's
--    spending completed by day 10) and has drifted to ~0.55 since. A median
--    over nine years lands at 0.256, which describes neither regime: on
--    2026-10-10 it turned €3,866 of spending into a projected €15,120 month
--    and a bogus "89% over your usual pace". The trailing 12 months give
--    0.493 and a sane reading. The level and the shape now share one window,
--    which also collapses two scans into one CTE.
--
-- 2. Instance dates are attributed in the caller's timezone, not UTC.
--    utils/transaction-fetcher.ts builds month windows from local midnight
--    (new Date(y, m-1, 1).toISOString()), so a payment posted just after
--    local midnight on the 1st belongs to this month on the transactions
--    page but fell into the previous month here.
--
-- Everything else — the split expansion, the exclusions, the medians,
-- projected = spent / frac — is unchanged from 017.

-- Adding p_tz changes the signature, so the 2-argument versions must go.
drop function if exists public.get_month_pace(uuid, date);
drop function if exists public.get_net_worth_series(uuid, date, text);

-- 1. Month pace: the Home hero block.
create or replace function public.get_month_pace(
  p_user_id uuid,
  p_month date,
  p_tz text default 'UTC'
)
returns table (
  month_start date,
  as_of_date date,
  spent_to_date numeric,
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
  -- No FROM clause: exactly one row, so a missing history yields nulls
  -- rather than no row at all.
  select
    (select percentile_cont(0.5) within group (order by total)
     from recent where type = 'expense')::numeric as usual_expenses,
    (select percentile_cont(0.5) within group (order by total)
     from recent where type = 'income')::numeric as usual_income
),
shape as (
  -- Share of a month's spending typically completed by this day of month.
  -- Months with no spending are skipped rather than counted as zero.
  select (percentile_cont(0.5) within group (order by thru / total))::numeric as frac
  from recent
  where type = 'expense' and total > 0
),
spent as (
  select coalesce(sum(i.eur), 0)::numeric as spent_to_date
  from instances i, v
  where i.type = 'expense'
    and i.instance_date between v.month_start and v.as_of_date
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
  s.spent_to_date,
  (l.usual_expenses * sh.frac)::numeric as typical_spent_to_date,
  case when sh.frac > 0 then (s.spent_to_date / sh.frac)::numeric end as projected_expenses,
  l.usual_income,
  case when sh.frac > 0
       then (l.usual_income - s.spent_to_date / sh.frac)::numeric end as projected_net,
  p.prior_30d_net
from v, spent s, level l, shape sh, prior30 p
$$;

comment on function public.get_month_pace(uuid, date, text) is
  'Month-to-date spending vs a typical month at the same point, projected to month end. Level and intra-month shape are both medians over the trailing 12 complete months. Dates are attributed in p_tz. Null projections mean there is not enough history yet.';

-- 2. Net worth trend: per-bucket deltas for the Home chart.
create or replace function public.get_net_worth_series(
  p_user_id uuid,
  p_from date,
  p_bucket text default 'month',
  p_tz text default 'UTC'
)
returns table (bucket_start date, delta numeric)
language sql
stable
as $$
with v as (
  select (now() at time zone p_tz)::date as as_of_date
),
instances as (
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
    and (t.date at time zone p_tz)::date >= p_from

  union all

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
    and (s.date at time zone p_tz)::date >= (p_from - interval '11 months')::date
),
bucketed as (
  select
    case p_bucket
      when 'day' then i.instance_date
      when 'week' then date_trunc('week', i.instance_date)::date
      else date_trunc('month', i.instance_date)::date
    end as bucket_start,
    case when i.type = 'income' then i.eur else -i.eur end as delta
  from instances i, v
  where i.instance_date >= p_from
    and i.instance_date <= v.as_of_date
)
select b.bucket_start, sum(b.delta)::numeric as delta
from bucketed b
group by b.bucket_start
order by b.bucket_start
$$;

comment on function public.get_net_worth_series(uuid, date, text, text) is
  'Per-bucket income-minus-expense deltas for the net worth trend, attributed in p_tz. The client anchors the series to the current fund total and walks backwards. p_bucket is day, week (Monday) or month.';

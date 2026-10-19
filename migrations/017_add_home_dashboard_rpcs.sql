-- 017_add_home_dashboard_rpcs.sql
--
-- Purpose: back the rebuilt Home dashboard with SQL aggregations, replacing
-- the client-side scans over raw transaction rows that the old dashboard
-- relied on (which fetched up to 9 years of rows, 1000 at a time, to draw a
-- single chart).
--
--  - get_month_pace: the "on track" block. Month-to-date spending against the
--    same point in a typical month, a projection to month end, and the
--    trailing 30-day net.
--  - get_net_worth_series: the "net worth" block's trend line. Per-bucket
--    deltas; the client walks backwards from today's fund total so the last
--    point equals the number printed above the chart.
--
-- SECURITY INVOKER (default, like get_fund_balances): the inner queries run
-- under the caller and are scoped by the RLS policies from migration 013.
--
-- Shared semantics, matching get_overall_total_eur (migration 007):
--  - amounts are EUR via coalesce(eur_amount, amount); rows with a null EUR
--    amount are skipped, as the client's calculateTotals does;
--  - money transfers and hide_from_totals rows are excluded;
--  - split_across_year sources are expanded into 12 monthly instances with
--    the rounding remainder in the source month, and instances dated in the
--    future are dropped. This is a port of expandSplitTransactionsForMonth
--    (utils/split-transactions.ts), except the EUR split is rounded at 2dp
--    rather than in the source currency's minor units — a difference of at
--    most a few cents per instance.
--  - months are attributed with date_trunc on the timestamptz, i.e. in
--    Supabase's session timezone (UTC), matching useDateRangeTransactions.
--    Transactions within a few hours of a month boundary may therefore land
--    in the neighbouring month relative to a CET-local reading.
--
-- Deliberately absent: recurring-payment detection and any forecast of
-- individual bills. "Usual" months are medians over history, which is also
-- what keeps occasional windfalls out of the baseline without classifying
-- them.

-- 1. Month pace: the Home hero block.
--
-- spent_to_date        expense EUR in p_month from its first day to as_of_date
-- typical_spent_to_date usual_expenses * frac — where a typical month would be
--                      by the same point
-- projected_expenses   spent_to_date scaled by the fraction of a typical month
--                      completed by now; null when there is no spending shape
--                      to learn from yet
-- usual_income         median monthly income over the trailing 12 complete
--                      months
-- projected_net        usual_income - projected_expenses
-- prior_30d_net        net over the 30 days ending as_of_date
--
-- "Usual" is the median over the trailing 12 complete months (the level of
-- the life you live now); frac is the median over all history of the share of
-- a month's spending completed by the same day of month (your stable
-- intra-month rhythm — nine years describe that better than twelve months).
create or replace function public.get_month_pace(p_user_id uuid, p_month date)
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
      current_date,
      (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date
    ) as as_of_date
  ) bounds
),
instances as (
  -- Regular transactions: one instance, on their own date.
  select
    t.date::date as instance_date,
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
  -- each dated on the source's day-of-month clamped to the target month's end.
  select
    least(
      (date_trunc('month', s.date) + (g.month_offset || ' month')::interval)::date
        + (extract(day from s.date)::int - 1),
      (date_trunc('month', s.date) + ((g.month_offset + 1) || ' month')::interval
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
spent as (
  select coalesce(sum(i.eur), 0)::numeric as spent_to_date
  from instances i, v
  where i.type = 'expense'
    and i.instance_date between v.month_start and v.as_of_date
),
window12 as (
  -- Totals per month and type over the trailing 12 complete months.
  select
    date_trunc('month', i.instance_date)::date as month_start,
    i.type,
    sum(i.eur) as total
  from instances i, v
  where i.instance_date >= (v.month_start - interval '12 months')::date
    and i.instance_date < v.month_start
  group by 1, 2
),
level as (
  -- No FROM clause: exactly one row, so a missing window12 yields nulls
  -- rather than no row at all.
  select
    (select percentile_cont(0.5) within group (order by total)
     from window12 where type = 'expense')::numeric as usual_expenses,
    (select percentile_cont(0.5) within group (order by total)
     from window12 where type = 'income')::numeric as usual_income
),
shape as (
  -- Share of a month's spending typically completed by this day of month.
  -- Months with no spending at all are skipped rather than counted as 0.
  select (percentile_cont(0.5) within group (order by frac))::numeric as frac
  from (
    select
      sum(case when extract(day from i.instance_date)::int <= v.as_of_day
               then i.eur else 0 end) / nullif(sum(i.eur), 0) as frac
    from instances i, v
    where i.type = 'expense'
      and i.instance_date < v.month_start
    group by date_trunc('month', i.instance_date)::date
  ) monthly
  where frac is not null
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

comment on function public.get_month_pace(uuid, date) is
  'Month-to-date spending vs a typical month at the same point, projected to month end. Usual level is a median over the trailing 12 complete months; intra-month shape is a median over all history. Null projections mean there is not enough history yet.';

-- 2. Net worth trend: per-bucket deltas for the Home chart.
--
-- Returns income-minus-expense per bucket; the client anchors the series to
-- today's fund total and walks backwards, so the final point equals the
-- number displayed above the chart.
--
-- p_bucket: 'day', 'week' (Monday, matching the client's 5Y bucketing), or
-- 'month'. Anything else falls back to 'month'.
--
-- Split sources dated up to 11 months before p_from can contribute inside the
-- range, so they are fetched too; the client's previous equivalent query had
-- no lower bound at all.
create or replace function public.get_net_worth_series(
  p_user_id uuid,
  p_from date,
  p_bucket text default 'month'
)
returns table (bucket_start date, delta numeric)
language sql
stable
as $$
with v as (
  select current_date as as_of_date
),
instances as (
  select
    t.date::date as instance_date,
    t.type::text as type,
    coalesce(t.eur_amount, t.amount) as eur
  from public.transactions t
  where t.user_id = p_user_id
    and t.is_money_transfer = false
    and t.hide_from_totals is not true
    and t.split_across_year = false
    and coalesce(t.eur_amount, t.amount) is not null
    and t.date::date >= p_from

  union all

  select
    least(
      (date_trunc('month', s.date) + (g.month_offset || ' month')::interval)::date
        + (extract(day from s.date)::int - 1),
      (date_trunc('month', s.date) + ((g.month_offset + 1) || ' month')::interval
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
    and s.date >= (p_from - interval '11 months')
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

comment on function public.get_net_worth_series(uuid, date, text) is
  'Per-bucket income-minus-expense deltas for the net worth trend. The client anchors the series to the current fund total and walks backwards. p_bucket is day, week (Monday) or month.';

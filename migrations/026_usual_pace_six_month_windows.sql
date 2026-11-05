-- 026_usual_pace_six_month_windows.sql
--
-- Widens the "usual" level windows from three months to six:
--   before: (average of the last 3 complete months
--            + average of the same 3 calendar months a year earlier) / 2
--   after:  (average of the last 6 complete months
--            + average of the same 6 calendar months a year earlier) / 2
--
-- The intra-month shape (median over the trailing 12 months) is unchanged, as
-- are the exclusions and timezone attribution. get_month_movers widens with it:
-- its deltas must keep explaining the headline percentage.
--
-- Rollback: re-run 025.

create or replace function public.get_month_pace(
  p_user_id uuid,
  p_month date,
  p_tz text default 'UTC'
)
returns table (
  month_start date,
  as_of_date date,
  spent_to_date numeric,
  split_spent_to_date numeric,
  net_to_date numeric,
  prev_month_net_to_day numeric,
  typical_spent_to_date numeric,
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
    coalesce(t.eur_amount, t.amount) as eur,
    false as is_split
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
    end as eur,
    true as is_split
  from public.transactions s
  cross join generate_series(0, 11) as g(month_offset)
  where s.user_id = p_user_id
    and s.is_money_transfer = false
    and s.hide_from_totals is not true
    and s.split_across_year = true
    and s.eur_amount is not null
),
recent as (
  -- The trailing 18 complete months of expenses: six for the recent level,
  -- six more a year earlier for the same-season level, and the last twelve
  -- for the shape. Income is not part of any figure this function returns.
  select
    date_trunc('month', i.instance_date)::date as month_start,
    sum(i.eur) as total,
    sum(case when extract(day from i.instance_date)::int <= v.as_of_day
             then i.eur else 0 end) as thru
  from instances i, v
  where i.type = 'expense'
    and i.instance_date >= (v.month_start - interval '18 months')::date
    and i.instance_date < v.month_start
  group by 1
),
level as (
  -- "Usual" is the average of two averages: the last six complete months,
  -- and the same six calendar months a year earlier. Only windows that have
  -- data are averaged, so a half-empty history does not halve the level.
  select
    (select avg(w.window_avg)
     from (
       select avg(m.total) as window_avg
       from recent m, v
       where m.month_start >= (v.month_start - interval '6 months')::date
       union all
       select avg(m.total)
       from recent m, v
       where m.month_start >= (v.month_start - interval '18 months')::date
         and m.month_start <  (v.month_start - interval '12 months')::date
     ) w)::numeric as usual_expenses
),
shape as (
  -- Median share of a month's spending completed by this day of month.
  select (percentile_cont(0.5) within group (order by m.thru / m.total))::numeric as frac
  from recent m, v
  where m.total > 0
    and m.month_start >= (v.month_start - interval '12 months')::date
),
to_date_totals as (
  select
    coalesce(sum(case when i.type = 'expense' then i.eur else 0 end), 0)::numeric
      as spent_to_date,
    coalesce(sum(case when i.type = 'expense' and i.is_split then i.eur else 0 end), 0)::numeric
      as split_spent_to_date,
    coalesce(sum(case when i.type = 'income' then i.eur else -i.eur end), 0)::numeric
      as net_to_date
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
  -- The 30 complete days ending yesterday; today is still partial.
  select coalesce(sum(
    case when i.type = 'income' then i.eur else -i.eur end
  ), 0)::numeric as prior_30d_net
  from instances i, v
  where i.instance_date between (v.as_of_date - 30) and (v.as_of_date - 1)
)
select
  v.month_start,
  v.as_of_date,
  t.spent_to_date,
  t.split_spent_to_date,
  t.net_to_date,
  pm.net_to_day as prev_month_net_to_day,
  (l.usual_expenses * sh.frac)::numeric as typical_spent_to_date,
  p.prior_30d_net
from v, to_date_totals t, prev_month pm, level l, shape sh, prior30 p
$$;

comment on function public.get_month_pace(uuid, date, text) is
  'Month-to-date spending (total and split-across-year share) and net, the same net for the previous month to the same day, and the typical spending by this day of month (average of the last 6 months and the same 6 months a year earlier, scaled by the median intra-month shape). Excludes money transfers and hidden rows; dates are attributed in p_tz.';

create or replace function public.get_month_movers(
  p_user_id uuid,
  p_month date,
  p_tz text default 'UTC'
)
returns table (
  main_category text,
  sub_category text,
  spent_to_date numeric,
  typical_to_date numeric,
  delta numeric
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
  select
    (t.date at time zone p_tz)::date as instance_date,
    t.type::text as type,
    coalesce(t.eur_amount, t.amount) as eur,
    coalesce(t.main_category, 'Uncategorized') as main_category,
    t.sub_category as sub_category
  from public.transactions t
  where t.user_id = p_user_id
    and t.is_money_transfer = false
    and t.hide_from_totals is not true
    and t.split_across_year = false
    and coalesce(t.eur_amount, t.amount) is not null

  union all

  select
    least(
      (date_trunc('month', s.date at time zone p_tz) + (g.month_offset || ' month')::interval)::date
        + (extract(day from (s.date at time zone p_tz))::int - 1),
      (date_trunc('month', s.date at time zone p_tz) + ((g.month_offset + 1) || ' month')::interval
        - interval '1 day')::date
    ) as instance_date,
    s.type::text,
    case
      when g.month_offset = 0 then s.eur_amount - 11 * round(s.eur_amount / 12.0, 2)
      else round(s.eur_amount / 12.0, 2)
    end as eur,
    coalesce(s.main_category, 'Uncategorized'),
    s.sub_category
  from public.transactions s
  cross join generate_series(0, 11) as g(month_offset)
  where s.user_id = p_user_id
    and s.is_money_transfer = false
    and s.hide_from_totals is not true
    and s.split_across_year = true
    and s.eur_amount is not null
),
global_shape as (
  -- Fallback for categories with no shape history of their own.
  select (percentile_cont(0.5) within group (order by thru / total))::numeric as frac
  from (
    select
      date_trunc('month', i.instance_date)::date as month_start,
      sum(i.eur) as total,
      sum(case when extract(day from i.instance_date)::int <= v.as_of_day
               then i.eur else 0 end) as thru
    from instances i, v
    where i.type = 'expense'
      and i.instance_date >= (v.month_start - interval '12 months')::date
      and i.instance_date < v.month_start
    group by 1
  ) m
  where total > 0
),
category_shape as (
  -- Each category's own intra-month timing, so a rent-style lump on the 1st
  -- is not judged against a spending profile that peaks at month end.
  select
    m.main_category,
    m.sub_category,
    (percentile_cont(0.5) within group (order by m.thru / m.total))::numeric as frac
  from (
    select
      i.main_category,
      i.sub_category,
      date_trunc('month', i.instance_date)::date as month_start,
      sum(i.eur) as total,
      sum(case when extract(day from i.instance_date)::int <= v.as_of_day
               then i.eur else 0 end) as thru
    from instances i, v
    where i.type = 'expense'
      and i.instance_date >= (v.month_start - interval '12 months')::date
      and i.instance_date < v.month_start
    group by 1, 2, 3
  ) m
  where m.total > 0
  group by 1, 2
),
window_months as (
  -- Per category, per month, inside the two level windows only.
  select
    i.main_category,
    i.sub_category,
    case
      when i.instance_date >= (v.month_start - interval '6 months')::date
        then 'recent'
      else 'last_year'
    end as window_name,
    date_trunc('month', i.instance_date)::date as month_start,
    sum(i.eur) as total
  from instances i, v
  where i.type = 'expense'
    and (i.instance_date >= (v.month_start - interval '6 months')::date
         and i.instance_date < v.month_start
      or i.instance_date >= (v.month_start - interval '18 months')::date
         and i.instance_date < (v.month_start - interval '12 months')::date)
  group by 1, 2, 3, 4
),
window_averages as (
  -- Average each window on its own first, so a category that appears in only
  -- two of a window's six months is not weighted less than a full one.
  select
    w.main_category,
    w.sub_category,
    w.window_name,
    avg(w.total) as window_avg
  from window_months w
  group by 1, 2, 3
),
level as (
  -- Equal weight per available window; a missing window is ignored.
  select
    wa.main_category,
    wa.sub_category,
    avg(wa.window_avg) as typical_month
  from window_averages wa
  group by 1, 2
),
spent as (
  select
    i.main_category,
    i.sub_category,
    sum(i.eur) as spent_to_date
  from instances i, v
  where i.type = 'expense'
    and i.instance_date between v.month_start and v.as_of_date
  group by 1, 2
),
combined as (
  select
    coalesce(sp.main_category, lv.main_category) as main_category,
    coalesce(sp.sub_category, lv.sub_category) as sub_category,
    coalesce(sp.spent_to_date, 0) as spent_to_date,
    coalesce(lv.typical_month, 0) as typical_month
  from spent sp
  full outer join level lv
    on lv.main_category = sp.main_category
   and lv.sub_category is not distinct from sp.sub_category
)
select
  c.main_category,
  c.sub_category,
  c.spent_to_date::numeric as spent_to_date,
  (c.typical_month * coalesce(cs.frac, gs.frac, 0))::numeric as typical_to_date,
  (c.spent_to_date
    - c.typical_month * coalesce(cs.frac, gs.frac, 0))::numeric as delta
from combined c
left join category_shape cs
  on cs.main_category = c.main_category
 and cs.sub_category is not distinct from c.sub_category
cross join global_shape gs
order by delta desc
$$;

comment on function public.get_month_movers(uuid, date, text) is
  'Per main/sub category delta between month-to-date spending and a typical month at the same point, using the same level and shape rules as get_month_pace. Ordered by delta descending; the client takes the extremes.';

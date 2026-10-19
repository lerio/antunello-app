-- 023_add_month_movers.sql
--
-- Per-category pace for the Home card's "likely culprits" list.
--
-- Each row compares what a category has cost so far this month with what a
-- typical month would have cost by the same day, using exactly the headline's
-- rule (022) so the deltas explain the headline percentage rather than
-- competing with it:
--
--   typical_month = average of the per-window averages
--                   (last 3 complete months, same 3 calendar months a year
--                    earlier), ignoring a window that has no data
--   typical_to_date = typical_month * shape
--   shape = median, over the trailing 12 complete months, of the share of a
--           month's spending completed by this day of month
--
-- The shape is per category, not the global one used by the headline. Rent
-- paid in one lump on the 1st has a shape near 1, whereas the global shape
-- says only a few percent of a month is spent by day 3 — using the global
-- figure would make Housing read as a culprit for the first week of every
-- month. Categories with no shape of their own (new categories) fall back to
-- the global one. Because shapes differ per category, the deltas will not sum
-- exactly to the headline gap; they explain it, they are not an audit.
--
-- Grouped by main_category and sub_category, because "Dining · Restaurants"
-- is actionable in a way that "Dining" alone is not. A category with no
-- subcategory returns null there.
--
-- The client picks the extremes: the largest positive deltas when the month is
-- running hot, the largest negative ones when it is running cold.
--
-- Splits, exclusions and timezone attribution match get_month_pace, including
-- the split-across-year expansion. The CTE is duplicated here rather than
-- shared: changing the two working aggregations to depend on a helper is a
-- refactor for another day, not a side effect of adding a list.

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
      when i.instance_date >= (v.month_start - interval '3 months')::date
        then 'recent'
      else 'last_year'
    end as window_name,
    date_trunc('month', i.instance_date)::date as month_start,
    sum(i.eur) as total
  from instances i, v
  where i.type = 'expense'
    and (i.instance_date >= (v.month_start - interval '3 months')::date
         and i.instance_date < v.month_start
      or i.instance_date >= (v.month_start - interval '15 months')::date
         and i.instance_date < (v.month_start - interval '12 months')::date)
  group by 1, 2, 3, 4
),
window_averages as (
  -- Average each window on its own first, so a category that appears in only
  -- two of a window's three months is not weighted less than a full one.
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

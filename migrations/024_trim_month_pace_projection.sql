-- 024_trim_month_pace_projection.sql
--
-- Removes the month projection from get_month_pace. The card no longer shows
-- "on track to save/overspend", so projected_expenses, usual_income and
-- projected_net had no reader left. Dropping them also removes the income
-- median from the function: what remains is expenses plus the two figures the
-- card actually prints (spent to date and the typical-by-today baseline).
--
-- income_to_date goes too. It existed to derive net_to_date, which is now
-- computed directly, and nothing else read it.
--
-- The return type changes, so the function is dropped rather than replaced.
-- Rollback: re-run 022.

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
  -- The trailing 15 complete months of expenses: three for the recent level,
  -- three more a year earlier for the same-season level, and the last twelve
  -- for the shape. Income is not part of any figure this function returns.
  select
    date_trunc('month', i.instance_date)::date as month_start,
    sum(i.eur) as total,
    sum(case when extract(day from i.instance_date)::int <= v.as_of_day
             then i.eur else 0 end) as thru
  from instances i, v
  where i.type = 'expense'
    and i.instance_date >= (v.month_start - interval '15 months')::date
    and i.instance_date < v.month_start
  group by 1
),
level as (
  -- "Usual" is the average of two averages: the last three complete months,
  -- and the same three calendar months a year earlier. Only windows that have
  -- data are averaged, so a half-empty history does not halve the level.
  select
    (select avg(w.window_avg)
     from (
       select avg(m.total) as window_avg
       from recent m, v
       where m.month_start >= (v.month_start - interval '3 months')::date
       union all
       select avg(m.total)
       from recent m, v
       where m.month_start >= (v.month_start - interval '15 months')::date
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
  t.net_to_date,
  pm.net_to_day as prev_month_net_to_day,
  (l.usual_expenses * sh.frac)::numeric as typical_spent_to_date,
  p.prior_30d_net
from v, to_date_totals t, prev_month pm, level l, shape sh, prior30 p
$$;

comment on function public.get_month_pace(uuid, date, text) is
  'Month-to-date spending and net, the same net for the previous month to the same day, and the typical spending by this day of month (average of the last 3 months and the same 3 months a year earlier, scaled by the median intra-month shape). Excludes money transfers and hidden rows; dates are attributed in p_tz.';

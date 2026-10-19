-- 019_net_worth_includes_hidden.sql
--
-- The net worth trend must move with the balance it is anchored to.
--
-- get_fund_balances — which produces the fund total printed above the chart —
-- applies no hide_from_totals filter, because a hidden transaction is a
-- display choice, not something that leaves the account untouched. The series
-- from 018 did filter them out, so every historical point sat below the truth
-- by the cumulative hidden amount since that date: the line would never have
-- met its own anchor.
--
-- Hidden rows are now included. Money transfers stay excluded: they move value
-- between the user's own funds, so they net to zero in the total.
--
-- get_month_pace is untouched. Spending figures should exclude hidden rows —
-- that is what hiding means — and they match the transactions page.
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
  'Per-bucket income-minus-expense deltas for the net worth trend, attributed in p_tz. Includes hidden transactions (matching get_fund_balances) and excludes money transfers. The client anchors the series to the current fund total and walks backwards. p_bucket is day, week (Monday) or month.';

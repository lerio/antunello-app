-- 017_add_home_dashboard_rpcs_rollback.sql
--
-- Reverts 017: drops the two Home dashboard aggregations. Nothing else
-- depends on them, so the app falls back to the client-side scans in
-- useAnchoredBalanceHistory and useDashboardComparison.

drop function if exists public.get_month_pace(uuid, date);
drop function if exists public.get_net_worth_series(uuid, date, text);

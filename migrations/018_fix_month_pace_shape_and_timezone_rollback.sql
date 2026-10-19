-- 018_fix_month_pace_shape_and_timezone_rollback.sql
--
-- Reverts 018. Re-running 017 recreates its 2-argument versions (all-history
-- shape, UTC attribution); this file only removes 018's signatures so the
-- names are free again.

drop function if exists public.get_month_pace(uuid, date, text);
drop function if exists public.get_net_worth_series(uuid, date, text, text);

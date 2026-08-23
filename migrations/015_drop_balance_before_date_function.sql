-- 015_drop_balance_before_date_function.sql
--
-- Purpose: drop the get_balance_before_date RPC, which became unused when
-- the balance chart was anchored to the Balance card total
-- (hooks/useAnchoredBalanceHistory.ts replaced useBalanceHistory /
-- useBalanceComparisonHistory / useStartingBalance, the RPC's only callers).

drop function if exists public.get_balance_before_date(uuid, date, boolean);

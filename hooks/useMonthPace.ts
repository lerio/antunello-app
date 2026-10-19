"use client";

import useSWR from "swr";
import { createClient } from "@/utils/supabase/client";

/**
 * The "on track" numbers for a calendar month, computed in SQL by the
 * `get_month_pace` RPC.
 */
interface MonthPace {
  /** First day of the month, as `YYYY-MM-DD`. */
  monthStart: string;
  /** The day the figures run to — today, or the month's last day if past. */
  asOfDate: string;
  /** Expenses so far this month. */
  spentToDate: number;
  /** Income minus expenses so far this month. Negative before payday. */
  netToDate: number;
  /** The previous month's net, measured to the same day of month. */
  prevMonthNetToDay: number | null;
  /** Where a typical month would be by the same day. Null without history. */
  typicalSpentToDate: number | null;
  /** Income minus expenses over the 30 complete days ending yesterday. */
  prior30dNet: number;
}

/** Row shape returned by the `get_month_pace` RPC. */
type MonthPaceRow = {
  month_start: string;
  as_of_date: string;
  spent_to_date: number;
  net_to_date: number;
  prev_month_net_to_day: number | null;
  typical_spent_to_date: number | null;
  prior_30d_net: number;
};

/** Numeric columns arrive as strings from PostgREST; nulls pass through. */
function toNumberOrNull(value: number | string | null): number | null {
  return value === null ? null : Number(value);
}

/**
 * Hook to fetch the current month's pace: what has been spent, where a
 * typical month would be by the same day, and how the net compares with the
 * previous month and the last 30 complete days.
 *
 * All arithmetic — including the split-across-year expansion and the
 * median-based "usual" month — happens in SQL, so no transaction rows cross
 * the wire.
 *
 * @returns An object containing:
 *  - `pace`: The month's figures, or `null` before the first load.
 *  - `isLoading`: `true` while the initial fetch is in-flight.
 *  - `error`: Any fetch error, or `undefined`.
 *  - `mutate`: SWR mutate function for manual refresh.
 */
export function useMonthPace() {
  const supabase = createClient();

  const { data, error, isLoading, mutate } = useSWR<MonthPace | null>(
    "month-pace",
    async () => {
      // Local session read (no network round trip) — getUser() would re-hit auth.
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return null;

      // The RPC resolves the month from p_month and attributes transactions in
      // p_tz, so both must be the *local* calendar date and zone — near
      // midnight on the 1st, the UTC date is still the previous month.
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const today = new Date().toLocaleDateString("en-CA", { timeZone });
      const { data: rows, error: rpcError } = await supabase.rpc("get_month_pace", {
        p_user_id: userId,
        p_month: today,
        p_tz: timeZone,
      });

      if (rpcError) throw rpcError;

      const row = (rows as MonthPaceRow[] | null)?.[0];
      if (!row) return null;

      return {
        monthStart: row.month_start,
        asOfDate: row.as_of_date,
        spentToDate: Number(row.spent_to_date) || 0,
        netToDate: Number(row.net_to_date) || 0,
        prevMonthNetToDay: toNumberOrNull(row.prev_month_net_to_day),
        typicalSpentToDate: toNumberOrNull(row.typical_spent_to_date),
        prior30dNet: Number(row.prior_30d_net) || 0,
      };
    }
  );

  return {
    pace: data ?? null,
    isLoading,
    error,
    mutate,
  };
}

/**
 * One category's contribution to this month's pace. `delta` is what it has
 * cost so far minus what a typical month would have spent by the same day —
 * positive when running hot, negative when running cold.
 */
export interface MonthMover {
  mainCategory: string;
  subCategory: string | null;
  spentToDate: number;
  typicalToDate: number;
  delta: number;
}

/** Row shape returned by the `get_month_movers` RPC. */
type MonthMoverRow = {
  main_category: string;
  sub_category: string | null;
  spent_to_date: number;
  typical_to_date: number;
  delta: number;
};

/**
 * Hook to fetch per-category pace for the "likely culprits" list.
 *
 * Uses the same level and shape rules as `get_month_pace`, so the deltas
 * explain the headline percentage rather than telling a separate story.
 *
 * @returns An object containing:
 *  - `movers`: Categories ordered by delta descending (largest over-spend first).
 *  - `isLoading`: `true` while the initial fetch is in-flight.
 *  - `error`: Any fetch error, or `undefined`.
 *  - `mutate`: SWR mutate function for manual refresh.
 */
export function useMonthMovers() {
  const supabase = createClient();

  const { data, error, isLoading, mutate } = useSWR<MonthMover[]>(
    "month-movers",
    async () => {
      // Local session read (no network round trip) — getUser() would re-hit auth.
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return [];

      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const today = new Date().toLocaleDateString("en-CA", { timeZone });
      const { data: rows, error: rpcError } = await supabase.rpc("get_month_movers", {
        p_user_id: userId,
        p_month: today,
        p_tz: timeZone,
      });

      if (rpcError) throw rpcError;

      return ((rows as MonthMoverRow[] | null) ?? []).map((row) => ({
        mainCategory: row.main_category,
        subCategory: row.sub_category,
        spentToDate: Number(row.spent_to_date) || 0,
        typicalToDate: Number(row.typical_to_date) || 0,
        delta: Number(row.delta) || 0,
      }));
    }
  );

  return {
    movers: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

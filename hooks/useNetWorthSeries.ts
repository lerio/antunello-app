"use client";

import useSWR from "swr";
import { createClient } from "@/utils/supabase/client";

/** Bucket widths the `get_net_worth_series` RPC understands. */
export type SeriesBucket = "day" | "week" | "month";

/**
 * One bucket of the net worth trend: the change in the fund total during that
 * bucket, as income minus expenses. Money transfers net to zero across funds
 * and are excluded; hidden transactions are included, matching the fund total
 * the series is anchored to.
 */
interface NetWorthBucket {
  /** Start of the bucket, `YYYY-MM-DD`. */
  date: string;
  delta: number;
}

/** Row shape returned by the `get_net_worth_series` RPC. */
type SeriesRow = {
  bucket_start: string;
  delta: number;
};

/** Stands in for "no lower bound" — the RPC needs a concrete date. */
const EPOCH = "1900-01-01";

/** The browser's zone, which is what the transactions page uses. */
function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Hook to fetch per-bucket balance deltas for the net worth trend.
 *
 * Returns deltas rather than balances because the caller anchors the series to
 * the current fund total and walks backwards, so the final point equals the
 * number displayed above the chart.
 *
 * @param from   - First date to include, or `null` for everything.
 * @param bucket - Bucket width: `day`, `week` (Monday) or `month`.
 */
export function useNetWorthSeries(from: string | null, bucket: SeriesBucket) {
  const supabase = createClient();

  const { data, error, isLoading, mutate } = useSWR<NetWorthBucket[]>(
    ["net-worth-series", from, bucket],
    async () => {
      // Local session read (no network round trip) — getUser() would re-hit auth.
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return [];

      const { data: rows, error: rpcError } = await supabase.rpc("get_net_worth_series", {
        p_user_id: userId,
        p_from: from ?? EPOCH,
        p_bucket: bucket,
        p_tz: localTimeZone(),
      });

      if (rpcError) throw rpcError;

      return ((rows as SeriesRow[] | null) ?? []).map((row) => ({
        date: row.bucket_start,
        delta: Number(row.delta) || 0,
      }));
    }
  );

  return { buckets: data ?? [], isLoading, error, mutate };
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { mutate as globalMutate } from "swr";
import { createClient } from "@/utils/supabase/client";
import { transactionCache } from "@/utils/simple-cache";
import { UpdateBanner } from "@/components/ui/update-banner";

/**
 * State exposed by the background sync provider for detecting remote updates.
 */
export interface BackgroundSyncState {
  /** Whether remote updates have been detected since the last refresh. */
  hasUpdates: boolean;
  /** Number of new/updated transactions detected. */
  updateCount: number;
  /** Dismiss the update notification. */
  dismissUpdate: () => void;
  /** Revalidate transaction data and reset the sync baseline. */
  refreshData: () => void;
  /**
   * Record a local mutation so the baseline is updated, preventing the
   * update banner from showing for changes originating on this device.
   */
  recordLocalMutation: () => Promise<void>;
}

const BackgroundSyncContext = createContext<BackgroundSyncState | undefined>(
  undefined
);

/**
 * SWR keys revalidated when a remote change is detected: transaction
 * month/year/range/split-source/fund caches (string keys) and
 * balance/starting-balance caches (array keys).
 */
function isTransactionDataKey(key: unknown): boolean {
  if (typeof key === "string") {
    return /^(transactions-|year-transactions-|range-transactions-|split-sources-|fund-categories)/.test(
      key
    );
  }
  if (Array.isArray(key) && typeof key[0] === "string") {
    return /^(balance-transactions-|starting-balance-|starting-balance-before-)/.test(
      key[0]
    );
  }
  return false;
}

/** How often to check for remote changes while the tab is visible. */
const POLL_INTERVAL_MS = 15000;

/**
 * Provider that polls Supabase for remote transaction changes (single user,
 * multiple devices) and auto-revalidates the visible data in place, with the
 * update banner as a visual cue.
 *
 * Mounted once in the `/protected` layout so every protected page (home,
 * transactions, budgets, year, …) stays in sync across devices.
 */
export function BackgroundSyncProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [hasUpdates, setHasUpdates] = useState(false);
  const [updateCount, setUpdateCount] = useState(0);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const lastCheckRef = useRef<{ count: number; lastUpdate: string } | null>(null);
  // Timestamp of when the tab was last hidden, to gate resume-time sync checks
  const hiddenAtRef = useRef<number | null>(null);
  // Stable ref so the effect and recordLocalMutation use the same client
  // without causing effect re-runs on every render.
  const supabaseRef = useRef(createClient());

  // Local session read (no network round trip) — getUser() would re-hit auth.
  useEffect(() => {
    const getSessionUser = async () => {
      const { data: { session } } = await supabaseRef.current.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
      }
    };
    getSessionUser();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const supabase = supabaseRef.current;

    const revalidateTransactionData = () => {
      // LRU-first fetchers would otherwise return stale copies, so clear it
      transactionCache.clear();
      globalMutate(isTransactionDataKey, undefined, { revalidate: true });
    };

    const checkForUpdates = async () => {
      // Skip if tab is hidden
      if (typeof document !== "undefined" && document.hidden) return;

      try {
        // Lightweight query - just get count and latest timestamp
        const { data, count, error } = await supabase
          .from("transactions")
          .select("id, updated_at", { count: "exact", head: false })
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(1);

        if (error) {
          console.error("Background sync error:", error);
          return;
        }

        const currentCount = count || 0;
        const currentLastUpdate = data?.[0]?.updated_at || "";

        if (!lastCheckRef.current) {
          // First check - store baseline
          lastCheckRef.current = {
            count: currentCount,
            lastUpdate: currentLastUpdate,
          };
        } else if (
          currentCount !== lastCheckRef.current.count ||
          currentLastUpdate !== lastCheckRef.current.lastUpdate
        ) {
          const diff = currentCount - lastCheckRef.current.count;
          setHasUpdates(true);
          setUpdateCount(Math.abs(diff));

          // Update baseline to new state
          lastCheckRef.current = {
            count: currentCount,
            lastUpdate: currentLastUpdate,
          };

          // Auto-refresh the visible data in place; the banner stays as a cue
          revalidateTransactionData();
        }
      } catch (err) {
        console.error("Background sync error:", err);
      }
    };

    // Initial check
    checkForUpdates();

    // Check every POLL_INTERVAL_MS
    const interval = setInterval(checkForUpdates, POLL_INTERVAL_MS);

    // Resume checking when the tab becomes visible again, but only after a
    // real absence: a quick tab flip shouldn't fire an immediate query and
    // add to the burst of work on iOS Safari tab resume.
    const handleVisibilityChange = () => {
      if (typeof document === "undefined") return;

      if (document.hidden) {
        hiddenAtRef.current = Date.now();
        return;
      }

      const hiddenAt = hiddenAtRef.current;
      hiddenAtRef.current = null;
      if (hiddenAt !== null && Date.now() - hiddenAt > 60000) {
        checkForUpdates();
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      clearInterval(interval);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [userId]);

  const dismissUpdate = useCallback(() => {
    setHasUpdates(false);
    setUpdateCount(0);
  }, []);

  const refreshData = useCallback(() => {
    // Clear simple cache and revalidate all transaction data
    transactionCache.clear();
    globalMutate(isTransactionDataKey, undefined, { revalidate: true });

    // Clear update state
    dismissUpdate();

    // Reset baseline so we detect future changes
    lastCheckRef.current = null;
  }, [dismissUpdate]);

  const recordLocalMutation = useCallback(async () => {
    // After a local mutation, update the baseline to prevent showing the banner
    // for changes that originated from this device
    try {
      const supabase = supabaseRef.current;
      const { data, count, error } = await supabase
        .from("transactions")
        .select("id, updated_at", { count: "exact", head: false })
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (error) {
        console.error("Failed to update baseline after mutation:", error);
        return;
      }

      const currentCount = count || 0;
      const currentLastUpdate = data?.[0]?.updated_at || "";

      lastCheckRef.current = {
        count: currentCount,
        lastUpdate: currentLastUpdate,
      };
    } catch (err) {
      console.error("Failed to update baseline after mutation:", err);
    }
  }, [userId]);

  return (
    <BackgroundSyncContext.Provider
      value={{ hasUpdates, updateCount, dismissUpdate, refreshData, recordLocalMutation }}
    >
      {hasUpdates && (
        <UpdateBanner
          updateCount={updateCount}
          onRefresh={refreshData}
          onDismiss={dismissUpdate}
        />
      )}
      {children}
    </BackgroundSyncContext.Provider>
  );
}

/**
 * Consume the background sync state provided by `BackgroundSyncProvider`.
 *
 * @returns The `BackgroundSyncState` object.
 * @throws If no provider is mounted (the hook is only valid under `/protected`).
 */
export function useBackgroundSyncContext(): BackgroundSyncState {
  const context = useContext(BackgroundSyncContext);
  if (!context) {
    throw new Error("useBackgroundSync must be used within a BackgroundSyncProvider");
  }
  return context;
}

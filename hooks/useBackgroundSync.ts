import {
  useBackgroundSyncContext,
  type BackgroundSyncState,
} from '@/components/layout/background-sync-provider'

export type { BackgroundSyncState }

/**
 * Hook to check for transaction updates in the background.
 *
 * The polling logic lives in `BackgroundSyncProvider` (mounted once in the
 * `/protected` layout) so every protected page detects remote changes from
 * other devices, auto-revalidates its data, and shows the update banner.
 * This hook simply consumes that shared state.
 *
 * @returns A `BackgroundSyncState` object with update indicators and control actions.
 */
export function useBackgroundSync(): BackgroundSyncState {
  return useBackgroundSyncContext()
}

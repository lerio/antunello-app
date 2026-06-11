import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { transactionCache } from '@/utils/simple-cache'

/**
 * State returned by the `useBackgroundSync` hook for tracking remote updates.
 */
export interface BackgroundSyncState {
  /** Whether remote updates have been detected since the last refresh. */
  hasUpdates: boolean
  /** Number of new/updated transactions detected. */
  updateCount: number
  /** Dismiss the update notification without refreshing data. */
  dismissUpdate: () => void
  /**
   * Refresh data and reset the sync baseline.
   * @param mutateFn - SWR mutate callback to revalidate the query.
   * @param context - Optional year/month context; when provided the simple cache is cleared for that period.
   */
  refreshData: (mutateFn: () => void, context?: { year: number; month: number }) => void
  /**
   * Record a local mutation so the baseline is updated, preventing the
   * update banner from showing for changes originating on this device.
   */
  recordLocalMutation: () => void
}

/**
 * Hook to check for transaction updates in the background
 * Polls Supabase every 60 seconds when tab is visible
 * Shows update banner when changes detected
 *
 * @param userId - The authenticated user's ID. Polling is disabled when `undefined`.
 * @returns A `BackgroundSyncState` object with update indicators and control actions.
 */
export function useBackgroundSync(userId: string | undefined): BackgroundSyncState {
  const [hasUpdates, setHasUpdates] = useState(false)
  const [updateCount, setUpdateCount] = useState(0)
  const lastCheckRef = useRef<{ count: number; lastUpdate: string } | null>(null)
  // Stable ref so the effect and recordLocalMutation use the same client
  // without causing effect re-runs on every render.
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    if (!userId) return
    const supabase = supabaseRef.current

    const checkForUpdates = async () => {
      // Skip if tab is hidden
      if (typeof document !== 'undefined' && document.hidden) return

      try {
        // Lightweight query - just get count and latest timestamp
        const { data, count, error } = await supabase
          .from('transactions')
          .select('id, updated_at', { count: 'exact', head: false })
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(1)

        if (error) {
          console.error('Background sync error:', error)
          return
        }

        const currentCount = count || 0
        const currentLastUpdate = data?.[0]?.updated_at || ''

        if (!lastCheckRef.current) {
          // First check - store baseline
          lastCheckRef.current = {
            count: currentCount,
            lastUpdate: currentLastUpdate,
          }
        } else {
          // Compare with last check
          if (
            currentCount !== lastCheckRef.current.count ||
            currentLastUpdate !== lastCheckRef.current.lastUpdate
          ) {
            const diff = currentCount - lastCheckRef.current.count
            setHasUpdates(true)
            setUpdateCount(Math.abs(diff))

            // Update baseline to new state
            lastCheckRef.current = {
              count: currentCount,
              lastUpdate: currentLastUpdate,
            }
          }
        }
      } catch (err) {
        console.error('Background sync error:', err)
      }
    }

    // Initial check
    checkForUpdates()

    // Check every 60 seconds
    const interval = setInterval(checkForUpdates, 60000)

    // Resume checking when tab becomes visible
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        checkForUpdates()
      }
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }

    return () => {
      clearInterval(interval)
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    }
  }, [userId]) // Only re-run when userId changes; supabase client is stable via ref

  const dismissUpdate = () => {
    setHasUpdates(false)
    setUpdateCount(0)
  }

  const refreshData = (mutateFn: () => void, context?: { year: number; month: number }) => {
    // Clear simple cache if context provided
    if (context) {
      transactionCache.clearRelated(context.year, context.month)
    }

    // Trigger SWR revalidation
    mutateFn()

    // Clear update state
    dismissUpdate()

    // Reset baseline so we detect future changes
    lastCheckRef.current = null
  }

  const recordLocalMutation = async () => {
    // After a local mutation, update the baseline to prevent showing the banner
    // for changes that originated from this device
    try {
      const supabase = supabaseRef.current
      const { data, count, error } = await supabase
        .from('transactions')
        .select('id, updated_at', { count: 'exact', head: false })
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)

      if (error) {
        console.error('Failed to update baseline after mutation:', error)
        return
      }

      const currentCount = count || 0
      const currentLastUpdate = data?.[0]?.updated_at || ''

      lastCheckRef.current = {
        count: currentCount,
        lastUpdate: currentLastUpdate,
      }
    } catch (err) {
      console.error('Failed to update baseline after mutation:', err)
    }
  }

  return { hasUpdates, updateCount, dismissUpdate, refreshData, recordLocalMutation }
}

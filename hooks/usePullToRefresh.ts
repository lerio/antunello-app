import { useEffect, useRef, useState } from 'react'

/**
 * Configuration options for the `usePullToRefresh` hook.
 */
interface PullToRefreshOptions {
  /** Callback invoked when the pull threshold is reached and the user releases */
  onRefresh: () => Promise<void> | void
  /** Distance in pixels the user must pull before refresh triggers (default: 80) */
  threshold?: number
  /** When `true`, the pull-to-refresh gesture is disabled entirely */
  disabled?: boolean
}

/**
 * Hook that implements a pull-to-refresh gesture for touch devices.
 *
 * Attaches `touchstart` / `touchmove` / `touchend` listeners to the document.
 * The gesture is only active when the page is scrolled to the top (`scrollY <= 5`).
 * A resistance curve (`0.5`) is applied to the pull distance for a natural feel.
 *
 * @param options - Configuration for the pull-to-refresh behavior.
 * @param options.onRefresh - Required async/sync callback triggered when the user
 *   pulls past the threshold and releases.
 * @param options.threshold - Pull distance threshold in pixels (default: 80).
 * @param options.disabled - Disables the gesture when `true` (default: false).
 *
 * @returns An object containing:
 *  - `isPulling` – `true` while the user is actively dragging downward
 *  - `pullDistance` – Current pull distance in pixels (resistance-adjusted)
 *  - `isRefreshing` – `true` while the `onRefresh` callback is executing
 *  - `isActive` – `true` when pulling or refreshing
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  disabled = false,
}: PullToRefreshOptions) {
  const [isPulling, setIsPulling] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const touchStartY = useRef(0)
  const isDragging = useRef(false)
  // Refs for values the event handlers need — using refs avoids re-registering
  // DOM listeners on every touch-move (which would happen if these were in the
  // useEffect dependency array as state values).
  const pullDistanceRef = useRef(0)
  const isRefreshingRef = useRef(false)
  const onRefreshRef = useRef(onRefresh)
  const thresholdRef = useRef(threshold)
  onRefreshRef.current = onRefresh
  thresholdRef.current = threshold

  useEffect(() => {
    if (disabled || typeof window === 'undefined') return

    const handleTouchStart = (e: TouchEvent) => {
      // Only allow pull-to-refresh when at the top of the page
      const scrollTop = window.scrollY || document.documentElement.scrollTop
      if (scrollTop > 5) return

      touchStartY.current = e.touches[0].clientY
      isDragging.current = true
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return

      const scrollTop = window.scrollY || document.documentElement.scrollTop
      if (scrollTop > 5) {
        isDragging.current = false
        setIsPulling(false)
        setPullDistance(0)
        pullDistanceRef.current = 0
        return
      }

      const touchY = e.touches[0].clientY
      const distance = touchY - touchStartY.current

      // Only pull down (positive distance)
      if (distance > 0) {
        // Prevent default to stop native pull-to-refresh
        e.preventDefault()

        // Apply resistance curve for better feel
        const resistance = 0.5
        const adjustedDistance = distance * resistance

        pullDistanceRef.current = adjustedDistance
        setPullDistance(adjustedDistance)
        setIsPulling(adjustedDistance > 20)
      }
    }

    const handleTouchEnd = async () => {
      if (!isDragging.current) return

      isDragging.current = false

      if (pullDistanceRef.current >= thresholdRef.current && !isRefreshingRef.current) {
        isRefreshingRef.current = true
        setIsRefreshing(true)

        try {
          await onRefreshRef.current()
        } catch (error) {
          console.error('Pull-to-refresh error:', error)
        } finally {
          // Small delay for better UX
          setTimeout(() => {
            isRefreshingRef.current = false
            setIsRefreshing(false)
            setIsPulling(false)
            setPullDistance(0)
            pullDistanceRef.current = 0
          }, 300)
        }
      } else {
        setIsPulling(false)
        setPullDistance(0)
        pullDistanceRef.current = 0
      }
    }

    // Use passive: false to allow preventDefault
    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [disabled]) // Only re-attach listeners when disabled state changes

  return {
    isPulling,
    pullDistance,
    isRefreshing,
    isActive: isPulling || isRefreshing,
  }
}

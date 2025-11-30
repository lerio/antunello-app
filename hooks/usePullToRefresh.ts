import { useEffect, useRef, useState } from 'react'

interface PullToRefreshOptions {
  onRefresh: () => Promise<void> | void
  threshold?: number
  disabled?: boolean
}

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

        setPullDistance(adjustedDistance)
        setIsPulling(adjustedDistance > 20)
      }
    }

    const handleTouchEnd = async () => {
      if (!isDragging.current) return

      isDragging.current = false

      if (pullDistance >= threshold && !isRefreshing) {
        setIsRefreshing(true)

        try {
          await onRefresh()
        } catch (error) {
          console.error('Pull-to-refresh error:', error)
        } finally {
          // Small delay for better UX
          setTimeout(() => {
            setIsRefreshing(false)
            setIsPulling(false)
            setPullDistance(0)
          }, 300)
        }
      } else {
        setIsPulling(false)
        setPullDistance(0)
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
  }, [onRefresh, threshold, pullDistance, disabled, isRefreshing])

  return {
    isPulling,
    pullDistance,
    isRefreshing,
    isActive: isPulling || isRefreshing,
  }
}

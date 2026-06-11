import { useState, useCallback, useRef } from 'react'

/** Direction of the slide animation: `'left'`, `'right'`, or `null` (idle). */
type SlideDirection = 'left' | 'right' | null

/** Current phase of the slide animation lifecycle. */
type AnimationPhase = 'idle' | 'sliding' | 'transitioning'

/**
 * Hook that manages slide-in/slide-out animation state for page navigation.
 *
 * Provides a coordinated two-phase animation:
 * 1. **Sliding** (300 ms): The current content slides out in the given direction.
 * 2. **Transitioning** (100 ms): The navigation callback fires and new content renders.
 * 3. **Idle**: Animation resets, ready for the next gesture.
 *
 * @returns An object containing:
 *  - `slideDirection` – The current slide direction (`'left'`, `'right'`, or `null`)
 *  - `animationPhase` – Current phase: `'idle'`, `'sliding'`, or `'transitioning'`
 *  - `isAnimating` – `true` while any phase of the animation is active
 *  - `startSlideAnimation(direction, onComplete?)` – Kick off an animation sequence
 *  - `resetAnimation()` – Immediately reset all animation state
 *  - `cleanup()` – Clear any pending timeouts (call on unmount)
 */
export function useSlideAnimation() {
  const [slideDirection, setSlideDirection] = useState<SlideDirection>(null)
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>('idle')
  const [isAnimating, setIsAnimating] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const callbackRef = useRef<(() => void) | null>(null)

  /**
   * Start a slide animation sequence in the specified direction.
   *
   * @param direction   - The direction the current content slides out
   * @param onComplete  - Optional callback invoked during the transition phase
   *                      (use for URL changes or data updates)
   */
  const startSlideAnimation = useCallback((direction: 'left' | 'right', onComplete?: () => void) => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Store the completion callback
    callbackRef.current = onComplete || null

    // Set animation state immediately for instant visual feedback
    setSlideDirection(direction)
    setAnimationPhase('sliding')
    setIsAnimating(true)

    // After the slide-out animation completes, transition to new content
    timeoutRef.current = setTimeout(() => {
      setAnimationPhase('transitioning')

      // Execute the navigation callback (URL change, data update)
      if (callbackRef.current) {
        callbackRef.current()
      }

      // After a brief moment, slide in the new content
      timeoutRef.current = setTimeout(() => {
        setAnimationPhase('idle')
        setSlideDirection(null)
        setIsAnimating(false)
        callbackRef.current = null
      }, 100) // Brief pause to allow new content to render
    }, 300) // Duration of slide-out animation
  }, [])

  /**
   * Immediately reset all animation state and clear pending timeouts.
   */
  const resetAnimation = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setSlideDirection(null)
    setAnimationPhase('idle')
    setIsAnimating(false)
    callbackRef.current = null
  }, [])

  /**
   * Clear any pending animation timeout without resetting state.
   * Intended for use in a `useEffect` cleanup function on unmount.
   */
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }, [])

  return {
    slideDirection,
    animationPhase,
    isAnimating,
    startSlideAnimation,
    resetAnimation,
    cleanup
  }
}

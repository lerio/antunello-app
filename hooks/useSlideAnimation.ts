import { useState, useCallback, useRef } from 'react'

type SlideDirection = 'left' | 'right' | null
type AnimationPhase = 'idle' | 'sliding' | 'transitioning'

export function useSlideAnimation() {
  const [slideDirection, setSlideDirection] = useState<SlideDirection>(null)
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>('idle')
  const [isAnimating, setIsAnimating] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const callbackRef = useRef<(() => void) | null>(null)

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

  const resetAnimation = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setSlideDirection(null)
    setAnimationPhase('idle')
    setIsAnimating(false)
    callbackRef.current = null
  }, [])

  // Cleanup on unmount
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
import { useEffect, useState, useCallback, useRef, useLayoutEffect } from 'react'

interface ModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly children: React.ReactNode
}

const ANIMATION_DURATION = 300

export function Modal({ isOpen, onClose, children }: ModalProps) {
  const [isAnimating, setIsAnimating] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)
  const [contentReady, setContentReady] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<MutationObserver | null>(null)
  const animationTriggeredRef = useRef(false)

  const handleSwipeDown = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    const startY = touch.clientY

    const handleTouchMove = (moveEvent: TouchEvent) => {
      const currentTouch = moveEvent.touches[0]
      const deltaY = currentTouch.clientY - startY

      if (deltaY > 50) {
        onClose()
        cleanup()
      }
    }

    const cleanup = () => {
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', cleanup)
    }

    document.addEventListener('touchmove', handleTouchMove, { passive: true })
    document.addEventListener('touchend', cleanup, { passive: true })
  }, [onClose])

  // Handle opening - mount the modal
  useEffect(() => {
    if (isOpen && !shouldRender) {
      setShouldRender(true)
      setContentReady(false)
      animationTriggeredRef.current = false
      document.body.style.overflow = 'hidden'
    }
  }, [isOpen, shouldRender])

  // Watch for content to be fully rendered using MutationObserver
  useEffect(() => {
    if (!shouldRender || !isOpen || animationTriggeredRef.current) return

    const content = contentRef.current
    if (!content) return

    // Function to check if content has meaningful children
    const checkContentReady = () => {
      // Check if the content has rendered children with actual height
      const hasContent = content.scrollHeight > 100 // Form should be at least 100px
      if (hasContent && !animationTriggeredRef.current) {
        animationTriggeredRef.current = true

        // Disconnect observer
        if (observerRef.current) {
          observerRef.current.disconnect()
          observerRef.current = null
        }

        // Force reflow and trigger animation
        const dialog = dialogRef.current
        if (dialog) {
          void dialog.offsetHeight
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setContentReady(true)
              setIsAnimating(true)
            })
          })
        }
      }
    }

    // Check immediately
    checkContentReady()

    // If not ready, observe for changes
    if (!animationTriggeredRef.current) {
      observerRef.current = new MutationObserver(() => {
        checkContentReady()
      })

      observerRef.current.observe(content, {
        childList: true,
        subtree: true,
        attributes: true,
      })

      // Fallback: trigger animation after max wait time
      const fallbackTimer = setTimeout(() => {
        if (!animationTriggeredRef.current) {
          animationTriggeredRef.current = true
          if (observerRef.current) {
            observerRef.current.disconnect()
            observerRef.current = null
          }
          setContentReady(true)
          setIsAnimating(true)
        }
      }, 150)

      return () => {
        clearTimeout(fallbackTimer)
        if (observerRef.current) {
          observerRef.current.disconnect()
          observerRef.current = null
        }
      }
    }
  }, [shouldRender, isOpen])

  // Handle closing animation
  useEffect(() => {
    if (!isOpen && shouldRender) {
      setIsAnimating(false)

      const timer = setTimeout(() => {
        setShouldRender(false)
        setContentReady(false)
        animationTriggeredRef.current = false
        document.body.style.overflow = 'unset'
      }, ANIMATION_DURATION)

      return () => clearTimeout(timer)
    }
  }, [isOpen, shouldRender])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = 'unset'
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    if (shouldRender) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [shouldRender, onClose])

  if (!shouldRender) return null

  const maxHeightStyle = 'calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 2rem)'

  return (
    <div
      className={`fixed inset-0 z-[105] overflow-hidden flex items-end justify-center transition-opacity duration-300 ease-out ${isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 focus:outline-none"
        aria-label="Close modal"
        onClick={onClose}
      />
      <dialog
        ref={dialogRef}
        open
        className={`relative z-10 w-full max-w-md sm:max-w-lg md:max-w-4xl mx-1 sm:mx-2 mb-2 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl overflow-hidden transform transition-all duration-300 ease-out ${isAnimating ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
          }`}
        style={{ maxHeight: maxHeightStyle }}
        aria-label="Modal dialog"
      >
        {/* Interactive Handle Bar */}
        <button
          type="button"
          className="w-full flex items-center justify-center py-4 border-b border-border cursor-pointer select-none active:bg-muted transition-colors"
          onClick={onClose}
          onTouchStart={handleSwipeDown}
          aria-label="Close modal - tap or swipe down"
        >
          <div className="w-12 h-1 bg-muted-foreground/50 rounded-full" />
        </button>

        {/* Scrollable Content */}
        <div
          ref={contentRef}
          className="overflow-y-auto overflow-x-hidden"
          style={{ maxHeight: maxHeightStyle }}
        >
          {children}
        </div>
      </dialog>
    </div>
  )
}
